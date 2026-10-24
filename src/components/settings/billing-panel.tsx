'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { readErrorMessage } from '@/lib/utils'
import { PLAN_PRICE_USD, SEAT_PRICE_USD, formatPlanPrice, type SeatInterval } from '@/lib/billing/seats'
import { btnPrimary, btnSecondary, Card, formatDate, Notice } from './ui'

type Props = {
  isOwner: boolean
  billingExempt: boolean
  plan: 'paid' | 'free_lifetime' | 'free_period'
  freeUntil: string | null
  freeAccess: boolean
  configured: boolean
  devBypass: boolean
  entitled: boolean
  hasCustomer: boolean
  subscription: {
    status: string
    currentPeriodEnd: string | null
    cancelAtPeriodEnd: boolean
    interval: SeatInterval
  } | null
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
  const [busy, setBusy] = useState<null | 'checkout' | 'portal' | 'interval'>(null)
  const [confirmSwitch, setConfirmSwitch] = useState(false)
  const [interval, setBillingInterval] = useState<SeatInterval>('month')
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
    const res = await fetch(`/api/billing/${kind}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(kind === 'checkout' ? { interval } : {}),
    })
    if (!res.ok) {
      setBusy(null)
      return toast.error(await readErrorMessage(res, 'Billing request failed'))
    }
    const { url } = await res.json()
    window.location.assign(url)
  }

  // Monthly ↔ annual on the existing subscription; Stripe prorates and invoices the difference now
  async function switchInterval(to: SeatInterval) {
    setBusy('interval')
    const res = await fetch('/api/billing/interval', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interval: to }),
    })
    setBusy(null)
    if (!res.ok) return toast.error(await readErrorMessage(res, 'Could not change the billing interval'))
    setConfirmSwitch(false)
    toast.success(to === 'year' ? 'You’re now billed annually' : 'You’re now billed monthly')
    router.refresh()
  }

  const statusLabel = sub
    ? (STATUS_LABEL[sub.status] ?? sub.status)
    : props.freeAccess
      ? (props.plan === 'free_period' ? 'Free period' : 'Free trial')
      : 'No subscription'

  return (
    <>
      {props.reason === 'subscription_required' && !props.entitled && (
        <Notice tone="warning">A subscription is required to use benchtop. Subscribe below to get access.</Notice>
      )}
      {props.welcome && !props.entitled && (
        <Notice tone="info">Welcome to benchtop. Your account is ready. Start your subscription to unlock all features.</Notice>
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
        ) : props.plan === 'free_lifetime' ? (
          <div className="space-y-4">
            <Notice tone="success">Your account is free for life. It never needs a subscription.</Notice>
            {sub && ['active', 'trialing', 'past_due'].includes(sub.status) && !sub.cancelAtPeriodEnd && (
              <Notice tone="warning">
                You still have a paid subscription from before. You can cancel it under Manage billing; you keep free access either way.
              </Notice>
            )}
            {props.isOwner && props.configured && props.hasCustomer && (
              <button className={btnSecondary} disabled={busy !== null} onClick={() => go('portal')}>
                {busy === 'portal' ? 'Opening…' : 'Manage billing'}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {!props.configured && (
              <Notice tone="warning">Billing is not configured in this environment, so subscriptions cannot be started or managed here.</Notice>
            )}
            {props.freeAccess && props.freeUntil && !(sub && props.entitled) && (
              <Notice tone="info">
                {props.plan === 'free_period' ? 'Your account is free' : 'Your free trial runs'} until {formatDate(props.freeUntil)}.
                {' '}Subscribe any time before then to keep access afterwards. You will not be charged until {formatDate(props.freeUntil)}.
              </Notice>
            )}
            {!props.freeAccess && props.freeUntil && !props.entitled && (
              <Notice tone="warning">
                {props.plan === 'free_period' ? 'Your free period' : 'Your free trial'} ended on {formatDate(props.freeUntil)}. Subscribe to keep using benchtop.
              </Notice>
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
                      props.entitled && (sub || props.freeAccess) ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {statusLabel}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Plan</dt>
                <dd className="text-gray-900">
                  benchtop (all features)
                  {sub && props.entitled && ` · ${sub.interval === 'year' ? 'Annual' : 'Monthly'}, ${formatPlanPrice(sub.interval)}`}
                </dd>
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

            {props.isOwner && props.configured && sub && props.entitled && !sub.cancelAtPeriodEnd && (() => {
              const to: SeatInterval = sub.interval === 'year' ? 'month' : 'year'
              return confirmSwitch ? (
                <div className="rounded-md border border-gray-200 p-3 space-y-3 text-sm">
                  <p className="text-gray-700">
                    Switch to {to === 'year' ? 'annual' : 'monthly'} billing at {formatPlanPrice(to)}
                    {' '}(extra team members ${SEAT_PRICE_USD[to]}/{to} each)?{' '}
                    {sub.status === 'trialing'
                      ? 'You won’t be charged until your trial ends.'
                      : `You’ll be charged for the new ${to} straight away, less a credit for the unused part of your current ${sub.interval}.`}
                  </p>
                  <div className="flex gap-2">
                    <button className={btnPrimary} disabled={busy !== null} onClick={() => switchInterval(to)}>
                      {busy === 'interval' ? 'Switching…' : `Switch to ${to === 'year' ? 'annual' : 'monthly'}`}
                    </button>
                    <button className={btnSecondary} disabled={busy !== null} onClick={() => setConfirmSwitch(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button className="text-sm text-blue-600 hover:underline" onClick={() => setConfirmSwitch(true)}>
                  {to === 'year'
                    ? `Switch to annual billing and save $${PLAN_PRICE_USD.month * 12 - PLAN_PRICE_USD.year} a year`
                    : 'Switch to monthly billing'}
                </button>
              )
            })()}

            {!props.isOwner && (
              <p className="text-sm text-gray-500">Only the account owner can start or manage the subscription.</p>
            )}

            {props.isOwner && props.configured && (!sub || !props.entitled) && (
              <fieldset>
                <legend className="text-sm text-gray-500 mb-2">Billing</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(['month', 'year'] as const).map(i => (
                    <label
                      key={i}
                      className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm ${
                        interval === i ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input type="radio" name="interval" value={i} checked={interval === i}
                        onChange={() => setBillingInterval(i)} className="mt-0.5" />
                      <span>
                        <span className="block font-medium text-gray-900">
                          {i === 'month' ? 'Monthly' : 'Annual'} · {formatPlanPrice(i)}
                        </span>
                        <span className="block text-xs text-gray-500">
                          {i === 'year'
                            ? `Save $${PLAN_PRICE_USD.month * 12 - PLAN_PRICE_USD.year} a year. `
                            : ''}
                          Extra team members ${SEAT_PRICE_USD[i]}/{i} each.
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
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
