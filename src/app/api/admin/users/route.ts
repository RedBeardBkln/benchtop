import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { accountMembers, accounts, profiles } from '@/lib/db/schema'
import { getAuthUsers } from '@/lib/admin-server'

// Platform admin: every login, with its account, role and when it was last used. Logins without
// an account (signed up without an invitation, or left over) are listed too.
export async function GET() {
  const auth = await requireApi({ allowUnentitled: true, platformAdmin: true })
  if (!auth.ok) return auth.res

  const [logins, members, people] = await Promise.all([
    getAuthUsers(),
    db
      .select({ userId: accountMembers.userId, role: accountMembers.role, accountId: accounts.id, accountName: accounts.name, accountSuspendedAt: accounts.suspendedAt })
      .from(accountMembers)
      .innerJoin(accounts, eq(accounts.id, accountMembers.accountId)),
    db
      .select({ userId: profiles.userId, fullName: profiles.fullName, lastSeenAt: profiles.lastSeenAt, suspendedAt: profiles.suspendedAt, isPlatformAdmin: profiles.isPlatformAdmin })
      .from(profiles),
  ])

  const memberBy = new Map(members.map(m => [m.userId, m]))
  const profileBy = new Map(people.map(p => [p.userId, p]))
  const ids = new Set([...logins.keys(), ...members.map(m => m.userId)])

  const users = [...ids].map(id => {
    const login = logins.get(id)
    const member = memberBy.get(id)
    const profile = profileBy.get(id)
    return {
      userId: id,
      email: login?.email ?? null,
      fullName: profile?.fullName ?? null,
      signedUpAt: login?.createdAt ?? null,
      lastSignInAt: login?.lastSignInAt ?? null,
      lastSeenAt: profile?.lastSeenAt ?? null,
      suspendedAt: profile?.suspendedAt ?? null,
      isPlatformAdmin: profile?.isPlatformAdmin ?? false,
      account: member ? { id: member.accountId, name: member.accountName, role: member.role, suspendedAt: member.accountSuspendedAt } : null,
    }
  })
  users.sort((a, b) => (a.email ?? '').localeCompare(b.email ?? ''))
  return NextResponse.json({ users, me: auth.ctx.user.id })
}
