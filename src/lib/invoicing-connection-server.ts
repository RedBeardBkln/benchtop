import { createHash, randomBytes } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { invoicingConnections } from '@/lib/db/schema'
import { contextForUser, type AuthContext } from '@/lib/auth/context'
import { recordActivity, touchLastSeen } from '@/lib/activity-server'
import { getAuthEmails } from '@/lib/supabase/admin'
import { needsLegalAcceptance } from '@/lib/legal'
import { bearerKey, canUseInvoicingConnection, CONNECTION_KEY_PREFIX } from '@/lib/invoicing-connection'

// Server side of the invoicing connection (see lib/invoicing-connection.ts): making and revoking
// keys, and resolving a key on the /api/connect routes to the person it acts as.

const hashKey = (key: string) => createHash('sha256').update(key).digest('hex')

export type ConnectionStatus = { createdAt: string; lastUsedAt: string | null; keyLast4: string } | null

export async function connectionStatus(ctx: AuthContext): Promise<ConnectionStatus> {
  const [row] = await db
    .select()
    .from(invoicingConnections)
    .where(and(eq(invoicingConnections.userId, ctx.user.id), isNull(invoicingConnections.revokedAt)))
    .limit(1)
  if (!row) return null
  return { createdAt: row.createdAt.toISOString(), lastUsedAt: row.lastUsedAt?.toISOString() ?? null, keyLast4: row.keyLast4 }
}

/** A new key for the caller, replacing any live one. The key is returned here and never again. */
export async function createConnectionKey(ctx: AuthContext): Promise<string> {
  const key = CONNECTION_KEY_PREFIX + randomBytes(32).toString('base64url')
  await db.transaction(async tx => {
    await tx
      .update(invoicingConnections)
      .set({ revokedAt: new Date() })
      .where(and(eq(invoicingConnections.userId, ctx.user.id), isNull(invoicingConnections.revokedAt)))
    await tx.insert(invoicingConnections).values({
      accountId: ctx.account.id,
      userId: ctx.user.id,
      keyHash: hashKey(key),
      keyLast4: key.slice(-4),
    })
  })
  return key
}

export async function revokeConnectionKey(ctx: AuthContext) {
  await db
    .update(invoicingConnections)
    .set({ revokedAt: new Date() })
    .where(and(eq(invoicingConnections.userId, ctx.user.id), isNull(invoicingConnections.revokedAt)))
}

const deny = (status: number, error: string) => NextResponse.json({ error }, { status })

export type ConnectionAuth = { ok: true; ctx: AuthContext } | { ok: false; res: NextResponse }

// For the /api/connect routes:  const auth = await requireConnection(req); if (!auth.ok) return auth.res
// The key acts as its person, with exactly their access, and only while they still pass every
// check a signed-in call would (account, suspension, subscription, terms) and are on the allow-list.
export async function requireConnection(req: NextRequest): Promise<ConnectionAuth> {
  const key = bearerKey(req.headers.get('authorization'))
  if (!key) return { ok: false, res: deny(401, 'Unauthorized') }

  const [row] = await db
    .select()
    .from(invoicingConnections)
    .where(and(eq(invoicingConnections.keyHash, hashKey(key)), isNull(invoicingConnections.revokedAt)))
    .limit(1)
  if (!row) return { ok: false, res: deny(401, 'Unauthorized') }

  const email = (await getAuthEmails([row.userId])).get(row.userId)
  if (!canUseInvoicingConnection(email)) return { ok: false, res: deny(403, 'This connection is not allowed') }

  const result = await contextForUser({ id: row.userId, email })
  // The key belongs to the account it was made in; a person who moved accounts needs a new one
  if (!result.ok || result.ctx.account.id !== row.accountId || needsLegalAcceptance(result.ctx.profile)) {
    return { ok: false, res: deny(403, 'This connection’s Benchtop login cannot be used right now') }
  }

  await db.update(invoicingConnections).set({ lastUsedAt: new Date() }).where(eq(invoicingConnections.id, row.id))
  return { ok: true, ctx: result.ctx }
}

/** Activity log entry for a change made through the connection (requireApi does this for the app) */
export async function trackConnectionChange(ctx: AuthContext, req: NextRequest) {
  await Promise.all([
    recordActivity({ accountId: ctx.account.id, userId: ctx.user.id, method: req.method, path: req.nextUrl.pathname }),
    touchLastSeen(ctx.user.id),
  ])
}
