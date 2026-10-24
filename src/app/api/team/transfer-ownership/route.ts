import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { accountMembers, auditLog } from '@/lib/db/schema'
import { getAuthEmails } from '@/lib/supabase/admin'
import { getStripe, isBillingConfigured } from '@/lib/billing/stripe'

const bodySchema = z.object({ userId: z.string().uuid() })

// Makes another team member the owner. The current owner becomes an admin, so they keep full access
// but no longer control billing or account deletion. The seat count doesn't change. Owner only.
export async function POST(req: NextRequest) {
  const auth = await requireApi({ allowUnentitled: true, role: 'owner' })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Choose a team member' }, { status: 400 })
  const { userId } = parsed.data
  if (userId === ctx.user.id) return NextResponse.json({ error: 'You already own this account' }, { status: 400 })

  const moved = await db.transaction(async tx => {
    const [target] = await tx
      .update(accountMembers)
      .set({ role: 'owner', access: null })
      .where(and(eq(accountMembers.accountId, ctx.account.id), eq(accountMembers.userId, userId)))
      .returning({ userId: accountMembers.userId })
    if (!target) return false
    await tx
      .update(accountMembers)
      .set({ role: 'admin', access: null })
      .where(and(eq(accountMembers.accountId, ctx.account.id), eq(accountMembers.userId, ctx.user.id)))
    await tx.insert(auditLog).values({
      accountId: ctx.account.id,
      entity: 'account',
      entityId: ctx.account.id,
      action: 'transfer_ownership',
      before: { owner: ctx.user.id },
      after: { owner: userId },
      userId: ctx.user.id,
    })
    return true
  })
  if (!moved) return NextResponse.json({ error: 'That person is not on your team' }, { status: 404 })

  // Stripe receipts and billing emails should go to the new owner; best effort
  if (ctx.account.stripeCustomerId && isBillingConfigured()) {
    try {
      const email = (await getAuthEmails([userId])).get(userId)
      if (email) await getStripe().customers.update(ctx.account.stripeCustomerId, { email })
    } catch (err) {
      console.error('[transfer-ownership] stripe customer email update failed:', err)
    }
  }

  return NextResponse.json({ ok: true })
}
