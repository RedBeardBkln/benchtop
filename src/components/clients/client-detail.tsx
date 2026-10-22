'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Copy, Edit2, Plus, Star, Trash2, X } from 'lucide-react'
import { EMPTY_ADDRESS, type CarrierAccount, type ClientAddress } from '@/lib/client-schemas'
import { readErrorMessage } from '@/lib/utils'

type Contact = {
  id: string
  name: string
  title: string | null
  email: string | null
  phone: string | null
  isPrimary: boolean
  notes: string | null
}

type ClientDetailData = {
  id: string
  name: string
  website: string | null
  notes: string | null
  legalName: string | null
  taxId: string | null
  paymentTerms: string | null
  currency: string | null
  poRequired: boolean
  billingEmail: string | null
  billingAddress: ClientAddress | null
  accountingNotes: string | null
  shippingAddress: ClientAddress | null
  upsAccount: string | null
  fedexAccount: string | null
  dhlAccount: string | null
  otherCarrierAccounts: CarrierAccount[]
  preferredCarrier: string | null
  shippingNotes: string | null
  contacts: Contact[]
  projects: Array<{ id: string; name: string; status: string }>
}

// Every editable field as the form holds it (strings, never null)
type Form = {
  name: string
  website: string
  notes: string
  legalName: string
  taxId: string
  paymentTerms: string
  currency: string
  poRequired: boolean
  billingEmail: string
  billingAddress: ClientAddress
  accountingNotes: string
  shippingAddress: ClientAddress
  upsAccount: string
  fedexAccount: string
  dhlAccount: string
  otherCarrierAccounts: CarrierAccount[]
  preferredCarrier: string
  shippingNotes: string
}

function toForm(c: ClientDetailData): Form {
  return {
    name: c.name,
    website: c.website ?? '',
    notes: c.notes ?? '',
    legalName: c.legalName ?? '',
    taxId: c.taxId ?? '',
    paymentTerms: c.paymentTerms ?? '',
    currency: c.currency ?? '',
    poRequired: c.poRequired,
    billingEmail: c.billingEmail ?? '',
    billingAddress: { ...EMPTY_ADDRESS, ...c.billingAddress },
    accountingNotes: c.accountingNotes ?? '',
    shippingAddress: { ...EMPTY_ADDRESS, ...c.shippingAddress },
    upsAccount: c.upsAccount ?? '',
    fedexAccount: c.fedexAccount ?? '',
    dhlAccount: c.dhlAccount ?? '',
    otherCarrierAccounts: c.otherCarrierAccounts ?? [],
    preferredCarrier: c.preferredCarrier ?? '',
    shippingNotes: c.shippingNotes ?? '',
  }
}

const inputCls =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'

function Field({ label, htmlFor, children, hint }: {
  label: string
  htmlFor: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

function Section({ title, description, children, action }: {
  title: string
  description?: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function AddressFields({ prefix, value, onChange }: {
  prefix: string
  value: ClientAddress
  onChange: (next: ClientAddress) => void
}) {
  const set = (k: keyof ClientAddress) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value })
  return (
    <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
      <div className="sm:col-span-6">
        <Field label="Street address" htmlFor={`${prefix}-line1`}>
          <input id={`${prefix}-line1`} value={value.line1} onChange={set('line1')} className={inputCls} autoComplete="off" />
        </Field>
      </div>
      <div className="sm:col-span-6">
        <Field label="Suite, unit, building (optional)" htmlFor={`${prefix}-line2`}>
          <input id={`${prefix}-line2`} value={value.line2} onChange={set('line2')} className={inputCls} autoComplete="off" />
        </Field>
      </div>
      <div className="sm:col-span-3">
        <Field label="City" htmlFor={`${prefix}-city`}>
          <input id={`${prefix}-city`} value={value.city} onChange={set('city')} className={inputCls} autoComplete="off" />
        </Field>
      </div>
      <div className="sm:col-span-1">
        <Field label="State / region" htmlFor={`${prefix}-region`}>
          <input id={`${prefix}-region`} value={value.region} onChange={set('region')} className={inputCls} autoComplete="off" />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Postal code" htmlFor={`${prefix}-postal`}>
          <input id={`${prefix}-postal`} value={value.postalCode} onChange={set('postalCode')} className={inputCls} autoComplete="off" />
        </Field>
      </div>
      <div className="sm:col-span-6">
        <Field label="Country" htmlFor={`${prefix}-country`}>
          <input id={`${prefix}-country`} value={value.country} onChange={set('country')} className={inputCls} autoComplete="off" />
        </Field>
      </div>
    </div>
  )
}

const emptyContact = { name: '', title: '', email: '', phone: '', notes: '', isPrimary: false }

function ContactForm({ initial, onSave, onCancel, saving }: {
  initial: typeof emptyContact
  onSave: (c: typeof emptyContact) => void
  onCancel: () => void
  saving: boolean
}) {
  const [c, setC] = useState(initial)
  const set = (k: 'name' | 'title' | 'email' | 'phone' | 'notes') =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setC({ ...c, [k]: e.target.value })
  return (
    <form
      className="rounded-md border border-blue-200 bg-blue-50/40 p-3 space-y-3"
      onSubmit={e => { e.preventDefault(); if (c.name.trim()) onSave(c) }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Name *" htmlFor="contact-name">
          <input id="contact-name" autoFocus value={c.name} onChange={set('name')} className={inputCls} />
        </Field>
        <Field label="Title / role" htmlFor="contact-title">
          <input id="contact-title" value={c.title} onChange={set('title')} placeholder="e.g. Purchasing, AP, R&D" className={inputCls} />
        </Field>
        <Field label="Email" htmlFor="contact-email">
          <input id="contact-email" type="email" value={c.email} onChange={set('email')} className={inputCls} />
        </Field>
        <Field label="Phone" htmlFor="contact-phone">
          <input id="contact-phone" type="tel" value={c.phone} onChange={set('phone')} className={inputCls} />
        </Field>
      </div>
      <Field label="Notes" htmlFor="contact-notes">
        <textarea id="contact-notes" value={c.notes} onChange={set('notes')} rows={2} className={`${inputCls} resize-y`} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={c.isPrimary} onChange={e => setC({ ...c, isPrimary: e.target.checked })} className="rounded border-gray-300" />
        Primary contact
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white hover:bg-gray-50">
          Cancel
        </button>
        <button type="submit" disabled={!c.name.trim() || saving}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save contact'}
        </button>
      </div>
    </form>
  )
}

function Contacts({ clientId, contacts }: { clientId: string; contacts: Contact[] }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['client', clientId] })
    queryClient.invalidateQueries({ queryKey: ['clients'] })
  }

  const save = useMutation({
    mutationFn: async ({ id, c }: { id: string | 'new'; c: typeof emptyContact }) => {
      const r = await fetch(id === 'new' ? `/api/clients/${clientId}/contacts` : `/api/clients/${clientId}/contacts/${id}`, {
        method: id === 'new' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...c, name: c.name.trim() }),
      })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not save contact'))
    },
    onSuccess: () => { refresh(); setEditing(null); toast.success('Contact saved') },
    onError: (e: Error) => toast.error(e.message),
  })

  const makePrimary = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/clients/${clientId}/contacts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPrimary: true }),
      })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not update contact'))
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/clients/${clientId}/contacts/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not remove contact'))
    },
    onSuccess: () => { refresh(); toast.success('Contact removed') },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Section
      title="Contacts"
      description="Who you work with at this client."
      action={editing === null && (
        <button onClick={() => setEditing('new')} className="flex items-center gap-1 text-sm text-blue-600 hover:underline shrink-0">
          <Plus size={14} /> Add contact
        </button>
      )}
    >
      <div className="space-y-3">
        {contacts.length === 0 && editing !== 'new' && (
          <p className="text-sm text-gray-400">No contacts yet.</p>
        )}
        {contacts.map(c => editing === c.id ? (
          <ContactForm
            key={c.id}
            initial={{
              name: c.name, title: c.title ?? '', email: c.email ?? '', phone: c.phone ?? '',
              notes: c.notes ?? '', isPrimary: c.isPrimary,
            }}
            saving={save.isPending}
            onSave={v => save.mutate({ id: c.id, c: v })}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <div key={c.id} className="flex items-start gap-3 rounded-md border border-gray-100 p-3">
            <div className="flex-1 min-w-0 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-gray-900">{c.name}</span>
                {c.title && <span className="text-gray-500">{c.title}</span>}
                {c.isPrimary && (
                  <span className="inline-flex px-1.5 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700">Primary</span>
                )}
              </div>
              <div className="text-gray-600 mt-0.5 break-words">
                {c.email && <a href={`mailto:${c.email}`} className="hover:underline">{c.email}</a>}
                {c.email && c.phone && <span className="text-gray-300"> · </span>}
                {c.phone && <a href={`tel:${c.phone}`} className="hover:underline">{c.phone}</a>}
              </div>
              {c.notes && <p className="text-xs text-gray-500 mt-1 whitespace-pre-line">{c.notes}</p>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!c.isPrimary && (
                <button onClick={() => makePrimary.mutate(c.id)} title="Make primary contact" aria-label={`Make ${c.name} the primary contact`}
                  className="p-1.5 text-gray-400 hover:text-blue-600 rounded">
                  <Star size={14} />
                </button>
              )}
              <button onClick={() => setEditing(c.id)} title="Edit contact" aria-label={`Edit ${c.name}`}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded">
                <Edit2 size={14} />
              </button>
              <button onClick={() => remove.mutate(c.id)} title="Remove contact" aria-label={`Remove ${c.name}`}
                className="p-1.5 text-gray-400 hover:text-red-600 rounded">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {editing === 'new' && (
          <ContactForm
            initial={{ ...emptyContact, isPrimary: contacts.length === 0 }}
            saving={save.isPending}
            onSave={v => save.mutate({ id: 'new', c: v })}
            onCancel={() => setEditing(null)}
          />
        )}
      </div>
    </Section>
  )
}

const PAYMENT_TERMS = ['Due on receipt', 'Prepaid', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'Net 90']
const CURRENCIES = ['USD', 'CAD', 'MXN', 'EUR', 'GBP', 'AUD']
const CARRIERS = ['UPS', 'FedEx', 'DHL', 'USPS', 'Freight / LTL', 'Client pickup']

function ClientForm({ client }: { client: ClientDetailData }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const initial = toForm(client)
  const [form, setForm] = useState<Form>(initial)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const dirty = JSON.stringify(form) !== JSON.stringify(initial)

  const text = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const save = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, name: form.name.trim() }),
      })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not save client'))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', client.id] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['client-options'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Client saved')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/clients/${client.id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not delete client'))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['client-options'] })
      toast.success(`${client.name} deleted`)
      router.push('/clients')
    },
    onError: (e: Error) => { toast.error(e.message); setConfirmDelete(false) },
  })

  const carriers = form.otherCarrierAccounts
  const setCarrier = (i: number, k: keyof CarrierAccount, v: string) =>
    setForm(f => ({ ...f, otherCarrierAccounts: f.otherCarrierAccounts.map((c, j) => (j === i ? { ...c, [k]: v } : c)) }))
  const incompleteCarrier = carriers.some(c => !c.carrier.trim() || !c.accountNumber.trim())

  return (
    // Not a <form>: the contact editor inside is one, and forms can't nest
    <div className="space-y-5 pb-20">
      <Section title="Details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Client name *" htmlFor="client-name" hint="Shown on projects. Renaming updates every linked project and team access grant.">
            <input id="client-name" value={form.name} onChange={text('name')} className={inputCls} />
          </Field>
          <Field label="Website" htmlFor="client-website">
            <input id="client-website" value={form.website} onChange={text('website')} placeholder="https://" className={inputCls} />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Notes" htmlFor="client-notes">
            <textarea id="client-notes" value={form.notes} onChange={text('notes')} rows={3} className={`${inputCls} resize-y`} />
          </Field>
        </div>
      </Section>

      <Contacts clientId={client.id} contacts={client.contacts} />

      <Section title="Accounting" description="How this client is billed.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Legal / billing name" htmlFor="client-legal">
            <input id="client-legal" value={form.legalName} onChange={text('legalName')} placeholder="If different from the client name" className={inputCls} />
          </Field>
          <Field label="Tax ID / EIN" htmlFor="client-tax">
            <input id="client-tax" value={form.taxId} onChange={text('taxId')} className={inputCls} autoComplete="off" />
          </Field>
          <Field label="Payment terms" htmlFor="client-terms">
            <input id="client-terms" list="payment-terms" value={form.paymentTerms} onChange={text('paymentTerms')} placeholder="e.g. Net 30" className={inputCls} />
            <datalist id="payment-terms">{PAYMENT_TERMS.map(t => <option key={t} value={t} />)}</datalist>
          </Field>
          <Field label="Currency" htmlFor="client-currency">
            <input id="client-currency" list="currencies" value={form.currency} onChange={text('currency')} placeholder="USD" maxLength={10} className={inputCls} />
            <datalist id="currencies">{CURRENCIES.map(t => <option key={t} value={t} />)}</datalist>
          </Field>
          <Field label="Invoices go to" htmlFor="client-billing-email">
            <input id="client-billing-email" type="email" value={form.billingEmail} onChange={text('billingEmail')} placeholder="ap@client.com" className={inputCls} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-gray-700 sm:mt-6">
            <input type="checkbox" checked={form.poRequired} onChange={e => setForm(f => ({ ...f, poRequired: e.target.checked }))} className="rounded border-gray-300" />
            Purchase order required on invoices
          </label>
        </div>
        <h3 className="text-xs font-semibold text-gray-700 mt-5 mb-2">Billing address</h3>
        <AddressFields prefix="billing" value={form.billingAddress} onChange={billingAddress => setForm(f => ({ ...f, billingAddress }))} />
        <div className="mt-3">
          <Field label="Accounting notes" htmlFor="client-acct-notes">
            <textarea id="client-acct-notes" value={form.accountingNotes} onChange={text('accountingNotes')} rows={2} className={`${inputCls} resize-y`} />
          </Field>
        </div>
      </Section>

      <Section title="Shipping" description="Where samples and orders go, and whose carrier account pays.">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-700">Ship-to address</h3>
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, shippingAddress: { ...f.billingAddress } }))}
            className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            <Copy size={12} /> Same as billing
          </button>
        </div>
        <AddressFields prefix="shipping" value={form.shippingAddress} onChange={shippingAddress => setForm(f => ({ ...f, shippingAddress }))} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
          <Field label="Preferred carrier" htmlFor="client-carrier">
            <input id="client-carrier" list="carriers" value={form.preferredCarrier} onChange={text('preferredCarrier')} className={inputCls} />
            <datalist id="carriers">{CARRIERS.map(t => <option key={t} value={t} />)}</datalist>
          </Field>
          <Field label="UPS account #" htmlFor="client-ups">
            <input id="client-ups" value={form.upsAccount} onChange={text('upsAccount')} className={inputCls} autoComplete="off" />
          </Field>
          <Field label="FedEx account #" htmlFor="client-fedex">
            <input id="client-fedex" value={form.fedexAccount} onChange={text('fedexAccount')} className={inputCls} autoComplete="off" />
          </Field>
          <Field label="DHL account #" htmlFor="client-dhl">
            <input id="client-dhl" value={form.dhlAccount} onChange={text('dhlAccount')} className={inputCls} autoComplete="off" />
          </Field>
        </div>

        <div className="mt-4">
          <div className="text-xs font-medium text-gray-600 mb-1">Other carrier accounts</div>
          <div className="space-y-2">
            {carriers.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={c.carrier}
                  onChange={e => setCarrier(i, 'carrier', e.target.value)}
                  placeholder="Carrier"
                  aria-label={`Carrier ${i + 1}`}
                  list="carriers"
                  className={`${inputCls} sm:max-w-[200px]`}
                />
                <input
                  value={c.accountNumber}
                  onChange={e => setCarrier(i, 'accountNumber', e.target.value)}
                  placeholder="Account #"
                  aria-label={`Account number ${i + 1}`}
                  className={inputCls}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, otherCarrierAccounts: f.otherCarrierAccounts.filter((_, j) => j !== i) }))}
                  aria-label={`Remove carrier account ${i + 1}`}
                  className="p-1.5 text-gray-400 hover:text-red-600 shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, otherCarrierAccounts: [...f.otherCarrierAccounts, { carrier: '', accountNumber: '' }] }))}
            className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            <Plus size={12} /> Add carrier account
          </button>
          {incompleteCarrier && <p className="mt-1 text-xs text-amber-700">Fill in both the carrier and account number, or remove the row.</p>}
        </div>

        <div className="mt-3">
          <Field label="Shipping notes" htmlFor="client-ship-notes">
            <textarea id="client-ship-notes" value={form.shippingNotes} onChange={text('shippingNotes')} rows={2}
              placeholder="Dock hours, cold-chain requirements, sample handling…" className={`${inputCls} resize-y`} />
          </Field>
        </div>
      </Section>

      <Section title="Projects">
        {client.projects.length === 0 ? (
          <p className="text-sm text-gray-400">No projects for this client yet. Pick this client when you create or edit a project.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {client.projects.map(p => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <Link href={`/projects/${p.id}`} className="text-gray-900 hover:text-blue-700 hover:underline">{p.name}</Link>
                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                  p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>{p.status}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Delete client">
        {client.projects.length > 0 ? (
          <p className="text-sm text-gray-500">
            A client with projects can&apos;t be deleted. Move its projects to another client first.
          </p>
        ) : confirmDelete ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-700">Delete {client.name} and its contacts?</span>
            <button type="button" onClick={() => remove.mutate()} disabled={remove.isPending}
              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50">
              {remove.isPending ? 'Deleting…' : 'Delete'}
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-md hover:bg-gray-50">
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-md hover:bg-red-50">
            <Trash2 size={14} /> Delete client
          </button>
        )}
      </Section>

      {/* Save bar */}
      {dirty && (
        <div className="fixed bottom-16 sm:bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-lg bg-ink-900 text-white px-4 py-2.5 shadow-lg">
          <span className="text-sm">Unsaved changes</span>
          <button type="button" onClick={() => setForm(initial)} className="text-sm text-gray-300 hover:text-white">
            Discard
          </button>
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={!form.name.trim() || incompleteCarrier || save.isPending}
            className="px-3 py-1.5 text-sm bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  )
}

export function ClientDetail({ id }: { id: string }) {
  const router = useRouter()
  const { data, isLoading, isError } = useQuery<ClientDetailData>({
    queryKey: ['client', id],
    queryFn: async () => {
      const r = await fetch(`/api/clients/${id}`)
      if (!r.ok) throw new Error('Not found')
      return r.json()
    },
  })

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-4xl">
      <button
        onClick={() => router.push('/clients')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6"
      >
        <ArrowLeft size={14} /> Clients
      </button>
      {isLoading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : isError || !data ? (
        <p className="text-sm text-red-500">Client not found.</p>
      ) : (
        <>
          <h1 className="text-2xl font-semibold text-gray-900 mb-6">{data.name}</h1>
          {/* Keyed on the saved record, so the form resets after a save that changes it */}
          <ClientForm key={JSON.stringify(toForm(data))} client={data} />
        </>
      )}
    </div>
  )
}
