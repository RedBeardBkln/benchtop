import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { accounts, subscriptions } from '@/lib/db/schema'
import { accountPlanUpdateSchema } from '@/lib/account-schemas'
import { ENTITLED_STATUSES } from '@/lib/billing/entitlement'
import { syncSeats } from '@/lib/billing/seat-sync'
import { isUuid, notFoundResponse } from '@/lib/tenancy'

type Ctx = { params: Promise<{ id: string }> }

// Platform admin: change an account's plan (see accountPlanUpdateSchema for what each plan takes).
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi({ allowUnentitled: true, platformAdmin: true })
  if (!auth.ok) return auth.res

  const { id } = await params
  if (!isUuid(id)) return notFoundResponse()

  const parsed = accountPlanUpdateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }
  const { plan, freeUntil, maxUsers } = parsed.data

  const [account] = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1)
  if (!account || account.deletedAt) return notFoundResponse()
  if (account.billingExempt) {
    return NextResponse.json(
      { error: 'Internal accounts are billing exempt and have no plan to change', code: 'billing_exempt' },
      { status: 409 },
    )
  }

  const [updated] = await db
    .update(accounts)
    .set({
      plan,
      freeUntil: plan === 'free_lifetime' || !freeUntil ? null : new Date(freeUntil),
      maxUsers: plan === 'free_lifetime' ? maxUsers ?? null : null,
    })
    .where(eq(accounts.id, id))
    .returning()

  // Seats are free on a free plan and billed on a subscription; bring Stripe in line either way
  const seats = await syncSeats(id).catch(err => ({ ok: false as const, error: String(err) }))
  if (!seats.ok) console.error('[admin/accounts] seat sync failed:', seats.error)

  // Changing the plan never touches Stripe; a running subscription keeps billing until canceled
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.accountId, id)).limit(1)
  const stillSubscribed = Boolean(sub?.stripeSubscriptionId) && ENTITLED_STATUSES.includes(sub!.status) && !sub!.cancelAtPeriodEnd
  const warning = plan !== 'paid' && stillSubscribed
    ? 'This account still has an active Stripe subscription, which keeps billing until it is canceled. The owner can cancel it under Settings → Billing → Manage billing, or you can cancel it in Stripe.'
    : null

  return NextResponse.json({ id: updated.id, plan: updated.plan, freeUntil: updated.freeUntil, maxUsers: updated.maxUsers, warning })
}
