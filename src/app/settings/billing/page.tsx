import { BillingPanel } from '@/components/settings/billing-panel'
import { requirePage } from '@/lib/auth/context'
import { isDevBypassActive } from '@/lib/billing/entitlement'
import { isBillingConfigured } from '@/lib/billing/stripe'

export default async function BillingSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; welcome?: string; checkout?: string; session_id?: string }>
}) {
  const ctx = await requirePage({ allowUnentitled: true })
  const sp = await searchParams

  return (
    <BillingPanel
      isOwner={ctx.role === 'owner'}
      billingExempt={ctx.account.billingExempt}
      configured={isBillingConfigured()}
      devBypass={isDevBypassActive()}
      entitled={ctx.entitled}
      hasCustomer={Boolean(ctx.account.stripeCustomerId)}
      subscription={
        ctx.subscription
          ? {
              status: ctx.subscription.status,
              currentPeriodEnd: ctx.subscription.currentPeriodEnd?.toISOString() ?? null,
              cancelAtPeriodEnd: ctx.subscription.cancelAtPeriodEnd,
            }
          : null
      }
      reason={sp.reason ?? null}
      welcome={sp.welcome === '1'}
      checkout={sp.checkout === 'success' || sp.checkout === 'cancelled' ? sp.checkout : null}
      sessionId={sp.session_id ?? null}
    />
  )
}
