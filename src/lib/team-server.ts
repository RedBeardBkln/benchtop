import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { accountMembers, profiles, projects } from '@/lib/db/schema'
import { getAuthEmails, getSupabaseAdmin, isAdminConfigured } from '@/lib/supabase/admin'
import { isAccountLogoPath } from '@/lib/logo'
import { removeLogo } from '@/lib/logo-server'
import { accessForRole, type MemberAccess, type MemberRole } from '@/lib/team-access'

// Server helpers for team management (DB access). Pure rules live in team-access.ts.

// Access as stored for `role`: null for owners/admins; for members, project grants are limited to
// the account's own projects so a forged id can never point into another account.
export async function accessToStore(
  accountId: string,
  role: MemberRole,
  access: MemberAccess | undefined,
): Promise<MemberAccess | null> {
  const base = accessForRole(role, access)
  if (!base) return null
  const ids = [...new Set(base.projects.map(p => p.projectId))]
  const owned = ids.length
    ? new Set(
        (
          await db
            .select({ id: projects.id })
            .from(projects)
            .where(and(eq(projects.accountId, accountId), inArray(projects.id, ids)))
        ).map(r => r.id),
      )
    : new Set<string>()
  const seenClients = new Set<string>()
  return {
    ...base,
    projects: base.projects.filter(p => owned.has(p.projectId)),
    // One grant per client (case-insensitive); the first one wins
    clients: base.clients.filter(c => {
      const key = c.client.trim().toLowerCase()
      if (seenClients.has(key)) return false
      seenClients.add(key)
      return true
    }),
  }
}

export async function listMembers(accountId: string) {
  const rows = await db
    .select({
      userId: accountMembers.userId,
      role: accountMembers.role,
      access: accountMembers.access,
      createdAt: accountMembers.createdAt,
      fullName: profiles.fullName,
    })
    .from(accountMembers)
    .leftJoin(profiles, eq(profiles.userId, accountMembers.userId))
    .where(eq(accountMembers.accountId, accountId))
    .orderBy(accountMembers.createdAt)
  const emails = await getAuthEmails(rows.map(r => r.userId))
  return rows.map(r => ({ ...r, email: emails.get(r.userId) ?? null }))
}

// Removes a member from the account and deletes their login (a login belongs to exactly one
// account, so it has no other use, and deleting it lets the email be invited again).
export async function removeMember(accountId: string, userId: string): Promise<{ loginRemoved: boolean }> {
  const [profile] = await db.select({ logoPath: profiles.logoPath }).from(profiles).where(eq(profiles.userId, userId)).limit(1)
  await db.transaction(async tx => {
    await tx
      .delete(accountMembers)
      .where(and(eq(accountMembers.accountId, accountId), eq(accountMembers.userId, userId)))
    await tx.delete(profiles).where(eq(profiles.userId, userId))
  })
  if (!isAdminConfigured()) return { loginRemoved: false }
  if (isAccountLogoPath(accountId, profile?.logoPath)) await removeLogo(profile.logoPath)
  const { error } = await getSupabaseAdmin().auth.admin.deleteUser(userId)
  if (error) console.error('[team] deleteUser failed:', error.message)
  return { loginRemoved: !error }
}
