import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { accounts } from '@/lib/db/schema'
import { adminSuspendSchema } from '@/lib/account-schemas'
import { recordAdminAction } from '@/lib/activity-server'
import { isUuid, notFoundResponse } from '@/lib/tenancy'

type Ctx = { params: Promise<{ id: string }> }

// Platform admin: suspend an account (nobody in it can use the app; nothing is deleted) or restore it.
// Billing is left alone: cancel the subscription separately if it shouldn't keep charging.
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi({ allowUnentitled: true, platformAdmin: true })
  if (!auth.ok) return auth.res

  const { id } = await params
  if (!isUuid(id)) return notFoundResponse()
  const [account] = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1)
  if (!account || account.deletedAt) return notFoundResponse()
  if (account.id === auth.ctx.account.id) {
    return NextResponse.json({ error: 'You can’t suspend your own account', code: 'own_account' }, { status: 403 })
  }

  const parsed = adminSuspendSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const { suspended, reason } = parsed.data

  const [updated] = await db
    .update(accounts)
    .set({ suspendedAt: suspended ? new Date() : null, suspendedReason: suspended ? reason || null : null })
    .where(eq(accounts.id, id))
    .returning({ suspendedAt: accounts.suspendedAt, suspendedReason: accounts.suspendedReason })

  await recordAdminAction({
    adminUserId: auth.ctx.user.id,
    accountId: id,
    action: suspended ? 'account.suspend' : 'account.restore',
    details: { accountName: account.name, reason: reason || null },
  })
  return NextResponse.json(updated)
}
