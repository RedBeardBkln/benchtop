import { and, eq, isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { accountMembers, clients, invitations, projects } from '@/lib/db/schema'
import { isUuid } from '@/lib/tenancy'
import { memberAccessSchema, renameClientGrants } from '@/lib/team-access'

// Server helpers for client records (DB access). Validation lives in client-schemas.ts.

export async function getOwnedClient(accountId: string, id: string) {
  if (!isUuid(id)) return null
  const [row] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.accountId, accountId)))
    .limit(1)
  return row ?? null
}

/** Postgres unique violation on the per-account client name. */
export function isDuplicateNameError(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } }
  return e?.code === '23505' || e?.cause?.code === '23505'
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * A client was renamed: keep each linked project's name copy and every team access grant
 * (members and pending invitations) pointing at it. Runs in the caller's transaction.
 */
export async function propagateClientRename(tx: Tx, accountId: string, clientId: string, from: string, to: string) {
  if (from === to) return
  await tx
    .update(projects)
    .set({ client: to })
    .where(and(eq(projects.accountId, accountId), eq(projects.clientId, clientId)))

  const members = await tx
    .select({ userId: accountMembers.userId, access: accountMembers.access })
    .from(accountMembers)
    .where(and(eq(accountMembers.accountId, accountId), isNotNull(accountMembers.access)))
  for (const m of members) {
    const parsed = memberAccessSchema.safeParse(m.access)
    const next = parsed.success ? renameClientGrants(parsed.data, from, to) : null
    if (next) await tx.update(accountMembers).set({ access: next }).where(eq(accountMembers.userId, m.userId))
  }

  const invites = await tx
    .select({ id: invitations.id, access: invitations.access })
    .from(invitations)
    .where(and(eq(invitations.accountId, accountId), isNotNull(invitations.access)))
  for (const inv of invites) {
    const parsed = memberAccessSchema.safeParse(inv.access)
    const next = parsed.success ? renameClientGrants(parsed.data, from, to) : null
    if (next) await tx.update(invitations).set({ access: next }).where(eq(invitations.id, inv.id))
  }
}
