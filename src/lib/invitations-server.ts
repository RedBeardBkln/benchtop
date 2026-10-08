import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { invitations } from '@/lib/db/schema'
import { failureReason, hashToken, type InviteFailure } from '@/lib/invitations'

// Looks up an invitation by plaintext token (compared by SHA-256 hash). Returns the pending invite
// or the reason it cannot be used.
export async function lookupInvite(
  token: string,
): Promise<{ ok: true; invite: typeof invitations.$inferSelect } | { ok: false; reason: InviteFailure }> {
  if (!token || token.length > 200) return { ok: false, reason: 'invalid' }
  const [invite] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.tokenHash, hashToken(token)))
    .limit(1)
  const reason = failureReason(invite)
  if (reason) return { ok: false, reason }
  return { ok: true, invite }
}
