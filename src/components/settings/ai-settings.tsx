'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { KeyRound } from 'lucide-react'
import { readErrorMessage } from '@/lib/utils'
import type { AllowanceState } from '@/lib/ai/allowance'
import { btnDanger, btnPrimary, btnSecondary, Card, Field, formatDate, inputCls, Notice } from '@/components/settings/ui'

type AiSettings = {
  usage: AllowanceState
  includedUsd: number
  ownKey: { provider: 'anthropic' | 'openai'; hint: string; model: string | null; updatedAt: string } | null
  canManageKey: boolean
  keyStorageReady: boolean
  addon: {
    configured: boolean
    canBuy: boolean
    subscribed: boolean
    units: number
    usdPerUnit: number
    price: { month: number; year: number }
    maxUnits: number
  }
  billingExempt: boolean
}

const KEY = ['ai-settings']
const PROVIDER_LABEL = { anthropic: 'Claude (Anthropic)', openai: 'OpenAI' } as const
const usd = (n: number) => `$${n.toFixed(2)}`

export function AiSettingsPanel() {
  const { data, isLoading, error } = useQuery<AiSettings>({
    queryKey: KEY,
    queryFn: async () => {
      const r = await fetch('/api/settings/ai')
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not load AI settings'))
      return r.json()
    },
  })

  if (error) return <Notice tone="error">{(error as Error).message}</Notice>
  if (isLoading || !data) return <p className="text-sm text-gray-500">Loading…</p>

  return (
    <div className="space-y-6">
      <UsageCard data={data} />
      <OwnKeyCard data={data} />
      {!data.billingExempt && <AddonCard data={data} />}
    </div>
  )
}

function UsageCard({ data }: { data: AiSettings }) {
  const { usage, ownKey } = data
  // The month turns over at midnight UTC; show that date, not the day before in US time zones
  const resets = new Date(usage.resetsAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })
  const unlimited = usage.allowanceUsd == null
  return (
    <Card
      tour="settings-ai-usage"
      title="AI this month"
      description="Sous Chef, label and photo reading, lab intake and AI research all use AI. Your team’s plan includes some each month; it resets on the 1st."
    >
      {ownKey && (
        <Notice tone="success">
          Your team’s own {PROVIDER_LABEL[ownKey.provider]} key is in use{ownKey.provider === 'openai' ? ' for Sous Chef' : ''}, so {ownKey.provider === 'openai' ? 'Sous Chef doesn’t count toward' : 'nothing counts toward'} the included AI below.
        </Notice>
      )}
      {unlimited ? (
        <p className={`text-sm text-gray-700 ${ownKey ? 'mt-4' : ''}`}>This account has no AI limit. {usd(usage.spentUsd)} used so far this month.</p>
      ) : (
        <div className={ownKey ? 'mt-4' : ''}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium text-gray-900">{usage.percent}% used</span>
            <span className="text-gray-500 tabular-nums">{usd(usage.spentUsd)} of {usd(usage.allowanceUsd!)}</span>
          </div>
          <div
            className="mt-2 h-2.5 rounded-full bg-gray-100 overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={usage.percent}
            aria-label="Included AI used this month"
          >
            <div
              className={`h-full rounded-full ${usage.exhausted ? 'bg-red-500' : usage.percent >= 80 ? 'bg-amber-500' : 'bg-lcd-400'}`}
              style={{ width: `${Math.max(usage.percent, usage.spentUsd > 0 ? 2 : 0)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {usage.exhausted
              ? `Used up. AI features pause until ${resets}, unless you add your own key or more AI below.`
              : `Resets ${resets}. Measured from what each AI request actually costs.`}
          </p>
        </div>
      )}
    </Card>
  )
}

function OwnKeyCard({ data }: { data: AiSettings }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const { ownKey, canManageKey } = data

  const remove = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/settings/ai', { method: 'DELETE' })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not remove the key'))
    },
    onSuccess: () => {
      toast.success('Key removed. AI now uses your included allowance.')
      queryClient.invalidateQueries({ queryKey: KEY })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Card
      tour="settings-ai-key"
      title="Use your own AI key"
      description="Add your team’s own Claude or OpenAI API key and your team’s AI runs on your account with that provider, with no monthly limit here. You pay the provider directly for what you use."
    >
      {ownKey ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-800">
            <KeyRound size={16} className="text-gray-500" />
            <span>
              <span className="font-medium">{PROVIDER_LABEL[ownKey.provider]}</span> key ending <span className="font-mono">{ownKey.hint}</span>
              {ownKey.model && <> · <span className="font-mono">{ownKey.model}</span></>}
              <span className="text-gray-500"> · added {formatDate(ownKey.updatedAt)}</span>
            </span>
          </div>
          {canManageKey && !editing && (
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditing(true)} className={btnSecondary}
                data-tip="Replace this key with another one">Replace</button>
              <button type="button" onClick={() => remove.mutate()} disabled={remove.isPending} className={btnDanger}
                data-tip="Stops using this key. AI goes back to your team’s included allowance.">Remove</button>
            </div>
          )}
        </div>
      ) : !canManageKey ? (
        <p className="text-sm text-gray-500">An owner or admin on your team can add one.</p>
      ) : !editing ? (
        <button type="button" onClick={() => setEditing(true)} className={btnPrimary}
          data-tip="Add a Claude or OpenAI API key for your whole team">Add a key</button>
      ) : null}

      {canManageKey && editing && (
        data.keyStorageReady
          ? <KeyForm onDone={() => { setEditing(false); queryClient.invalidateQueries({ queryKey: KEY }) }} onCancel={() => setEditing(false)} />
          : <Notice tone="warning">Saving your own key isn’t available yet. Please try again later.</Notice>
      )}

      <ul className="mt-4 text-xs text-gray-500 space-y-1 list-disc pl-4">
        <li>A <strong>Claude</strong> key runs every AI feature.</li>
        <li>An <strong>OpenAI</strong> key runs Sous Chef. Label and photo reading, lab intake and AI research still use Claude and your included allowance.</li>
        <li>The key is stored encrypted and is never shown again. Anyone on your team uses it through Benchtop; only owners and admins can change it.</li>
      </ul>
    </Card>
  )
}

function KeyForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [provider, setProvider] = useState<'anthropic' | 'openai'>('anthropic')
  const [apiKey, setApiKey] = useState('')
  const [models, setModels] = useState<string[] | null>(null)
  const [model, setModel] = useState('')
  const [busy, setBusy] = useState<'check' | 'save' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pick = (p: 'anthropic' | 'openai') => { setProvider(p); setModels(null); setModel(''); setError(null) }

  async function checkOpenAi() {
    setBusy('check'); setError(null)
    const r = await fetch('/api/settings/ai/models', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey }),
    })
    setBusy(null)
    if (!r.ok) { setError(await readErrorMessage(r, 'Could not check the key')); return }
    const body = await r.json() as { models: string[]; suggested: string | null }
    setModels(body.models)
    setModel(body.suggested ?? '')
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (provider === 'openai' && !models) return checkOpenAi()
    setBusy('save'); setError(null)
    const r = await fetch('/api/settings/ai', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(provider === 'openai' ? { provider, apiKey, model } : { provider, apiKey }),
    })
    setBusy(null)
    if (!r.ok) { setError(await readErrorMessage(r, 'Could not save the key')); return }
    toast.success('Key saved. Your team’s AI now runs on it.')
    onDone()
  }

  return (
    <form onSubmit={save} className="mt-4 space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex gap-2" role="radiogroup" aria-label="Provider">
        {(['anthropic', 'openai'] as const).map(p => (
          <button key={p} type="button" role="radio" aria-checked={provider === p} onClick={() => pick(p)}
            className={`flex-1 py-1.5 text-sm rounded-md border transition-colors ${
              provider === p ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}>
            {PROVIDER_LABEL[p]}
          </button>
        ))}
      </div>
      <Field
        label="API key"
        htmlFor="ai-key"
        hint={provider === 'anthropic'
          ? 'From console.anthropic.com › API keys. Starts with sk-ant-.'
          : 'From platform.openai.com › API keys. Starts with sk-.'}
      >
        <input id="ai-key" type="password" autoComplete="off" required value={apiKey}
          onChange={e => { setApiKey(e.target.value); setModels(null) }} className={`${inputCls} font-mono`} />
      </Field>
      {provider === 'openai' && models && (
        <Field label="Model for Sous Chef" htmlFor="ai-model" hint="Models this key can use. The suggested one is picked for you.">
          <select id="ai-model" value={model} onChange={e => setModel(e.target.value)} className={inputCls} required>
            {models.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={btnSecondary}>Cancel</button>
        <button type="submit" disabled={!apiKey.trim() || busy !== null || (provider === 'openai' && !!models && !model)} className={btnPrimary}
          data-tip="Checks the key with the provider before saving it">
          {busy === 'check' ? 'Checking…' : busy === 'save' ? 'Saving…' : provider === 'openai' && !models ? 'Check key' : 'Save key'}
        </button>
      </div>
    </form>
  )
}

function AddonCard({ data }: { data: AiSettings }) {
  const queryClient = useQueryClient()
  const { addon } = data
  const [units, setUnits] = useState(addon.units)

  const save = useMutation({
    mutationFn: async (n: number) => {
      const r = await fetch('/api/billing/ai-addon', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ units: n }),
      })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not change the AI add-on'))
    },
    onSuccess: (_d, n) => {
      toast.success(n === 0 ? 'AI add-on removed' : 'AI add-on updated')
      queryClient.invalidateQueries({ queryKey: KEY })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const each = `$${addon.price.month}/month or $${addon.price.year}/year`
  return (
    <Card
      tour="settings-ai-addon"
      title="Need more AI?"
      description={`Each AI add-on adds $${addon.usdPerUnit} of AI a month to your team’s included $${data.includedUsd}, for ${each} on your subscription.`}
    >
      {!addon.configured ? (
        <p className="text-sm text-gray-500">The AI add-on isn’t available yet. You can add your own key above instead.</p>
      ) : !addon.canBuy ? (
        <p className="text-sm text-gray-500">
          {addon.units > 0 ? `Your team has ${addon.units} AI add-on${addon.units === 1 ? '' : 's'}. ` : ''}Only the account owner can change this.
        </p>
      ) : !addon.subscribed ? (
        <p className="text-sm text-gray-500">
          Add-ons go on your subscription. <Link href="/settings/billing" className="text-blue-600 hover:underline">Subscribe</Link> first, or add your own key above.
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <Field label="AI add-ons" htmlFor="ai-units">
            <select id="ai-units" value={units} onChange={e => setUnits(Number(e.target.value))} className={`${inputCls} w-40`}>
              {Array.from({ length: addon.maxUnits + 1 }, (_, n) => (
                <option key={n} value={n}>{n === 0 ? 'None' : `${n} (+$${n * addon.usdPerUnit}/month of AI)`}</option>
              ))}
            </select>
          </Field>
          <button type="button" onClick={() => save.mutate(units)} disabled={units === addon.units || save.isPending} className={btnPrimary}
            data-tip="Changes your subscription now. Stripe prorates the difference on your next invoice.">
            {save.isPending ? 'Updating…' : 'Update subscription'}
          </button>
        </div>
      )}
    </Card>
  )
}
