'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { readErrorMessage } from '@/lib/utils'
import { btnPrimary, btnSecondary, Card, formatDate, Notice } from './ui'

type Props = {
  isOwner: boolean
  billingExempt: boolean
  configured: boolean
  devBypass: boolean
  entitled: boolean
  hasCustomer: boolean
  subscription: { status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean } | null
  reason: string | null
  welcome: boolean
  checkout: 'success' | 'cancelled' | null
  sessionId: string | null
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  trialing: 'Trial',
  past_due: 'Payment past due',
  canceled: 'Canceled',
  unpaid: 'Unpaid',
  incomplete: 'Incomplete',
  incomplete_expired: 'Expired',
  paused: 'Paused',
}

export function BillingPanel(props: Props) {
  const router = useRouter()
  const { subscription: sub } = props
  const [busy, setBusy] = useState<null | 'checkout' | 'portal'>(null)
  const [syncing, setSyncing] = useState(props.checkout === 'success' && Boolean(props.sessionId))
  const syncedRef = useRef(false)

  // Returning from Checkout: confirm the session now so access does not wait on the webhook
  useEffect(() => {
    if (props.checkout !== 'success' || !props.sessionId || syncedRef.current) return
    syncedRef.current = true
    ;(async () => {
      const res = await fetch('/api/billing/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: props.sessionId }),
      })
      if (!res.ok) toast.error(await readErrorMessage(res, 'Could not confirm your subscription yet'))
      setSyncing(false)
      router.replace('/settings/billing')
      router.refresh()
    })()
  }, [props.checkout, props.sessionId, router])

  async function go(kind: 'checkout' | 'portal') {
    setBusy(kind)
    const res = await fetch(`/api/billing/${kind}`, { method: 'POST' })
    if (!res.ok) {
      setBusy(null)
      return toast.error(await readErrorMessage(res, 'Billing request failed'))
    }
    const { url } = await res.json()
    window.location.assign(url)
  }

  const statusLabel = sub ? (STATUS_LABEL[sub.status] ?? sub.status) : 'No subscription'

  return (
    <>
      {props.reason === 'subscription_required' && !props.entitled && (
        <Notice tone="warning">A subscription is required to use Benchtop. Subscribe below to get access.</Notice>
      )}
      {props.welcome && !props.entitled && (
        <Notice tone="info">Welcome to Benchtop! Your account is ready. Start your subscription to unlock all features.</Notice>
      )}
      {props.checkout === 'cancelled' && <Notice tone="info">Checkout was cancelled. You have not been charged.</Notice>}
      {syncing && <Notice tone="info">Confirming your payment…</Notice>}
      {sub?.status === 'past_due' && (
        <Notice tone="warning">
          Your last payment did not go through. You still have access while we retry, but please update your payment method.
        </Notice>
      )}

      <Card title="Subscription">
        {props.billingExempt ? (
          <Notice tone="success">This is an internal account. It is billing exempt and never needs a subscription.</Notice>
        ) : (
          <div className="space-y-4">
            {!props.configured && (
              <Notice tone="warning">Billing is not configured in this environment, so subscriptions cannot be started or managed here.</Notice>
            )}
            {props.devBypass && !sub && (
              <Notice tone="info">Developer bypass is on (BILLING_DEV_BYPASS), so this account has access without a subscription. This has no effect in production.</Notice>
            )}

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Status</dt>
                <dd>
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      props.entitled && sub ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {statusLabel}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Plan</dt>
                <dd className="text-gray-900">Benchtop (all features)</dd>
              </div>
              {sub?.currentPeriodEnd && (
                <div>
                  <dt className="text-gray-500">{sub.cancelAtPeriodEnd ? 'Access until' : 'Renews on'}</dt>
                  <dd className="text-gray-900">{formatDate(sub.currentPeriodEnd)}</dd>
                </div>
              )}
            </dl>

            {sub?.cancelAtPeriodEnd && sub.currentPeriodEnd && (
              <Notice tone="warning">Your subscription is set to cancel on {formatDate(sub.currentPeriodEnd)}. You keep full access until then.</Notice>
            )}

            {!props.isOwner && (
              <p className="text-sm text-gray-500">Only the account owner can start or manage the subscription.</p>
            )}

            {props.isOwner && props.configured && (
              <div className="flex flex-wrap gap-3">
                {(!sub || !props.entitled) && (
                  <button className={btnPrimary} disabled={busy !== null} onClick={() => go('checkout')}>
                    {busy === 'checkout' ? 'Redirecting…' : sub ? 'Resubscribe' : 'Subscribe'}
                  </button>
                )}
                {props.hasCustomer && (
                  <button className={btnSecondary} disabled={busy !== null} onClick={() => go('portal')}>
                    {busy === 'portal' ? 'Opening…' : 'Manage billing'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </Card>
    </>
  )
}
