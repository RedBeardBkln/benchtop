'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Copy, Plus, Trash2, X } from 'lucide-react'
import { EMPTY_ADDRESS, type CarrierAccount, type ClientAddress } from '@/lib/client-schemas'
import { readErrorMessage } from '@/lib/utils'
import { AddressFields, Contacts, Field, Section, inputCls, type Contact } from '@/components/records/record-fields'
import { Term } from '@/components/term'

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

      <Contacts
        endpoint={`/api/clients/${client.id}/contacts`}
        contacts={client.contacts}
        description="Who you work with at this client."
        onChange={() => {
          queryClient.invalidateQueries({ queryKey: ['client', client.id] })
          queryClient.invalidateQueries({ queryKey: ['clients'] })
        }}
      />

      <Section title="Accounting" description="How this client is billed.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Legal / billing name" htmlFor="client-legal">
            <input id="client-legal" value={form.legalName} onChange={text('legalName')} placeholder="If different from the client name" className={inputCls} />
          </Field>
          <Field label="Tax ID / EIN" htmlFor="client-tax" tip="The client’s tax number (in the US, their Employer Identification Number), for invoices and records.">
            <input id="client-tax" value={form.taxId} onChange={text('taxId')} className={inputCls} autoComplete="off" />
          </Field>
          <Field label="Payment terms" htmlFor="client-terms" term="paymentTerms">
            <input id="client-terms" list="payment-terms" value={form.paymentTerms} onChange={text('paymentTerms')} placeholder="e.g. Net 30" className={inputCls} />
            <datalist id="payment-terms">{PAYMENT_TERMS.map(t => <option key={t} value={t} />)}</datalist>
          </Field>
          <Field label="Currency" htmlFor="client-currency" tip="The currency you invoice this client in, as a code such as USD or CAD.">
            <input id="client-currency" list="currencies" value={form.currency} onChange={text('currency')} placeholder="USD" maxLength={10} className={inputCls} />
            <datalist id="currencies">{CURRENCIES.map(t => <option key={t} value={t} />)}</datalist>
          </Field>
          <Field label="Invoices go to" htmlFor="client-billing-email" tip="The email address this client wants invoices sent to, usually accounts payable. For your records; benchtop doesn’t send invoices.">
            <input id="client-billing-email" type="email" value={form.billingEmail} onChange={text('billingEmail')} placeholder="ap@client.com" className={inputCls} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-gray-700 sm:mt-6"
            data-tip="Tick if this client needs their purchase order number on every invoice. A reminder for your records.">
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
            data-tip="Copies the billing address into the ship-to address, once. Later billing changes aren’t copied over."
            className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            <Copy size={12} /> Same as billing
          </button>
        </div>
        <AddressFields prefix="shipping" value={form.shippingAddress} onChange={shippingAddress => setForm(f => ({ ...f, shippingAddress }))} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
          <Field label="Preferred carrier" htmlFor="client-carrier" tip="The shipping company this client normally wants you to use.">
            <input id="client-carrier" list="carriers" value={form.preferredCarrier} onChange={text('preferredCarrier')} className={inputCls} />
            <datalist id="carriers">{CARRIERS.map(t => <option key={t} value={t} />)}</datalist>
          </Field>
          <Field label="UPS account #" htmlFor="client-ups" tip="The client’s own UPS account number, so shipments can be billed to them.">
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
                  data-tip="Remove this carrier account"
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
            data-tip="Add another carrier and the client’s account number with it"
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
                }`}>
                  <Term tip={p.status === 'active' ? 'Active: the project is in progress.' : 'Archived: marked finished or on hold. It still counts as linked to this client.'}>
                    {p.status}
                  </Term>
                </span>
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
              data-tip="Permanently deletes this client and all its contacts. This can’t be undone."
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
            data-tip="Deletes this client and its contacts. You’ll be asked to confirm."
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-md hover:bg-red-50">
            <Trash2 size={14} /> Delete client
          </button>
        )}
      </Section>

      {/* Save bar */}
      {dirty && (
        <div className="fixed bottom-16 sm:bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-lg bg-ink-900 text-white px-4 py-2.5 shadow-lg">
          <span className="text-sm">Unsaved changes</span>
          <button type="button" onClick={() => setForm(initial)} data-tip="Undo every unsaved change on this page" className="text-sm text-gray-300 hover:text-white">
            Discard
          </button>
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={!form.name.trim() || incompleteCarrier || save.isPending}
            data-tip={!form.name.trim()
              ? 'Enter a client name first.'
              : incompleteCarrier
                ? 'Fill in or remove the half-finished carrier account first.'
                : 'Saves your changes to Details, Accounting and Shipping. Contacts save on their own.'}
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
