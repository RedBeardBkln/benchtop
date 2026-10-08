/**
 * Attaches existing Supabase users to the legacy (staff) account and marks platform admins.
 * Run with: pnpm db:bootstrap [--emails a@x.com,b@y.com] [--apply]
 *
 * SAFE BY DEFAULT: without --apply this is a DRY RUN. It prints exactly what it would change and
 * writes nothing. Review the list (every user listed would get access to the legacy staff
 * workspace and all of its data), then re-run with --apply. Prefer --emails with an explicit list;
 * with no --emails the run considers EVERY Supabase auth user, including any leftover or
 * self-signed-up login, so make sure public signups are disabled first.
 *
 * Idempotent: running it twice produces the same state and the second run changes nothing.
 *
 *  1. Lists Supabase auth users and adds each one that has NO membership yet to the legacy
 *     account as a `member` (users already in any account are left alone).
 *  2. Ensures every such user has a `profiles` row.
 *  3. For emails in PLATFORM_ADMIN_EMAILS (comma separated, case-insensitive): sets
 *     profiles.is_platform_admin = true and, in the legacy account, role = owner.
 *
 * User discovery: the Supabase admin API when SUPABASE_SERVICE_ROLE_KEY and
 * NEXT_PUBLIC_SUPABASE_URL are set, otherwise a direct read of auth.users over DATABASE_URL.
 * `--emails` restricts the run to the listed users (handy without admin API access).
 *
 * Until this has run, existing staff get 403 "no account" by design (deny by default).
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { and, eq, inArray, ne } from 'drizzle-orm'
import { createClient } from '@supabase/supabase-js'
import * as schema from '../src/lib/db/schema'

const { accounts, accountMembers, profiles, LEGACY_ACCOUNT_ID } = schema

type AuthUser = { id: string; email: string; fullName: string | null }

function parseEmails(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
}

function argValue(name: string): string | undefined {
  const idx = process.argv.indexOf(name)
  if (idx !== -1) return process.argv[idx + 1]
  const kv = process.argv.find(a => a.startsWith(name + '='))
  return kv ? kv.slice(name.length + 1) : undefined
}

async function listUsersViaAdminApi(): Promise<AuthUser[]> {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const users: AuthUser[] = []
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`Supabase admin API: ${error.message}`)
    for (const u of data.users) {
      if (!u.email) continue
      const meta = u.user_metadata as { full_name?: string } | null
      users.push({ id: u.id, email: u.email.toLowerCase(), fullName: meta?.full_name ?? null })
    }
    if (data.users.length < 1000) break
  }
  return users
}

async function listUsersViaSql(client: postgres.Sql): Promise<AuthUser[]> {
  const rows = await client<{ id: string; email: string | null; full_name: string | null }[]>`
    select id, email, raw_user_meta_data->>'full_name' as full_name from auth.users`
  return rows.filter(r => r.email).map(r => ({ id: r.id, email: r.email!.toLowerCase(), fullName: r.full_name }))
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set (expected in .env.local)')

  const adminEmails = parseEmails(process.env.PLATFORM_ADMIN_EMAILS)
  if (adminEmails.length === 0) {
    console.warn('WARNING: PLATFORM_ADMIN_EMAILS is not set; no platform admins will be created.')
  }
  const onlyEmails = parseEmails(argValue('--emails'))
  const apply = process.argv.includes('--apply')
  console.log(apply ? 'Mode: APPLY (changes will be written)' : 'Mode: DRY RUN (nothing is written; re-run with --apply to make these changes)')
  if (apply && onlyEmails.length === 0) {
    console.warn('WARNING: --apply without --emails grants legacy-workspace access to EVERY auth user without a membership.')
  }

  const client = postgres(process.env.DATABASE_URL, { prepare: false })
  const db = drizzle(client, { schema })

  try {
    const [legacy] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.id, LEGACY_ACCOUNT_ID)).limit(1)
    if (!legacy) {
      throw new Error('The legacy account does not exist. Apply the 0007 drizzle migration first (pnpm db:migrate).')
    }

    // ---- discover users
    let users: AuthUser[]
    const adminApiAvailable = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL)
    if (adminApiAvailable) {
      console.log('Listing users via the Supabase admin API...')
      users = await listUsersViaAdminApi()
    } else {
      console.log('SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL not set; reading auth.users over DATABASE_URL...')
      try {
        users = await listUsersViaSql(client)
      } catch (err) {
        throw new Error(
          'Could not list users: no Supabase admin credentials and auth.users is not readable from DATABASE_URL ' +
            `(${err instanceof Error ? err.message : String(err)}). Set SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL.`,
        )
      }
    }
    if (onlyEmails.length > 0) {
      users = users.filter(u => onlyEmails.includes(u.email))
      const missing = onlyEmails.filter(e => !users.some(u => u.email === e))
      for (const e of missing) console.warn(`WARNING: no auth user found for ${e}`)
    }

    // ---- existing state
    const existingMembers = await db
      .select({ userId: accountMembers.userId, accountId: accountMembers.accountId })
      .from(accountMembers)
    const memberAccount = new Map(existingMembers.map(m => [m.userId, m.accountId]))
    const existingProfiles = await db.select({ userId: profiles.userId, isPlatformAdmin: profiles.isPlatformAdmin }).from(profiles)
    const profileByUser = new Map(existingProfiles.map(p => [p.userId, p]))

    let added = 0
    let profilesCreated = 0
    let adminsSet = 0
    let ownersSet = 0
    let skippedOtherAccount = 0

    for (const u of users) {
      const isAdmin = adminEmails.includes(u.email)
      const currentAccount = memberAccount.get(u.id)

      if (!currentAccount) {
        if (apply) {
          await db.insert(accountMembers).values({
            accountId: LEGACY_ACCOUNT_ID,
            userId: u.id,
            role: isAdmin ? 'owner' : 'member',
          })
        }
        added++
        console.log(`+ ${u.email} ${apply ? 'added' : 'would be added'} to the legacy account as ${isAdmin ? 'owner' : 'member'}`)
      } else if (currentAccount !== LEGACY_ACCOUNT_ID) {
        skippedOtherAccount++
        console.log(`= ${u.email} already belongs to another account; not moved`)
        // Still allowed to be a platform admin below
      }

      // profile
      const profile = profileByUser.get(u.id)
      if (!profile) {
        if (apply) {
          await db.insert(profiles).values({ userId: u.id, fullName: u.fullName, isPlatformAdmin: isAdmin }).onConflictDoNothing()
        }
        profilesCreated++
        if (isAdmin) adminsSet++
      } else if (isAdmin && !profile.isPlatformAdmin) {
        if (apply) {
          await db.update(profiles).set({ isPlatformAdmin: true, updatedAt: new Date() }).where(eq(profiles.userId, u.id))
        }
        adminsSet++
        console.log(`* ${u.email} ${apply ? 'marked' : 'would be marked'} as platform admin`)
      }
    }

    // Promote legacy-account members that are admins but not yet owners (no-op when already done)
    const adminUserIds = users.filter(u => adminEmails.includes(u.email)).map(u => u.id)
    if (adminUserIds.length > 0) {
      const promoteWhere = and(
        inArray(accountMembers.userId, adminUserIds),
        eq(accountMembers.accountId, LEGACY_ACCOUNT_ID),
        ne(accountMembers.role, 'owner'),
      )
      if (apply) {
        const promoted = await db
          .update(accountMembers)
          .set({ role: 'owner' })
          .where(promoteWhere)
          .returning({ userId: accountMembers.userId })
        ownersSet = promoted.length
      } else {
        const wouldPromote = await db.select({ userId: accountMembers.userId }).from(accountMembers).where(promoteWhere)
        ownersSet = wouldPromote.length
      }
    }

    console.log('')
    console.log(apply ? 'Summary' : 'Summary (DRY RUN: nothing was written)')
    const w = apply ? '' : 'would be '
    const row = (label: string, n: number) => console.log(`  ${label}`.padEnd(48) + n)
    row('users considered:', users.length)
    row(`${w}added to legacy account:`, added)
    row(`profiles ${w}created:`, profilesCreated)
    row(`platform admins ${w}newly set:`, adminsSet)
    row(`admins ${w}promoted to owner:`, ownersSet)
    row('left in another account:', skippedOtherAccount)
    if (added + profilesCreated + adminsSet + ownersSet === 0) console.log('  (nothing to change; already up to date)')
    else if (!apply) console.log('\nRe-run with --apply to make these changes.')
  } finally {
    await client.end()
  }
}

main().catch(err => {
  console.error('Bootstrap failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
