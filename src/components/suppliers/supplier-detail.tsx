'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, ExternalLink, Trash2 } from 'lucide-react'
import { EMPTY_ADDRESS, type ClientAddress } from '@/lib/client-schemas'
import type { SupplierIngredient } from '@/lib/suppliers-server'
import { readErrorMessage } from '@/lib/utils'
import { AddressFields, Contacts, Field, Section, inputCls, type Contact } from '@/components/records/record-fields'
import { Term } from '@/components/term'

type SupplierDetailData = {
  id: string
  name: string
  websiteUrl: string | null
  email: string | null
  phone: string | null
  address: ClientAddress | null
  accountNumber: string | null
  paymentTerms: string | null
  notes: string | null
  contacts: Contact[]
  ingredients: SupplierIngredient[]
}

// Every editable field as the form holds it (strings, never null)
type Form = {
  name: string
  websiteUrl: string
  email: string
  phone: string
  address: ClientAddress
  accountNumber: string
  paymentTerms: string
  notes: string
}

function toForm(s: SupplierDetailData): Form {
  return {
    name: s.name,
    websiteUrl: s.websiteUrl ?? '',
    email: s.email ?? '',
    phone: s.phone ?? '',
    address: { ...EMPTY_ADDRESS, ...s.address },
    accountNumber: s.accountNumber ?? '',
    paymentTerms: s.paymentTerms ?? '',
    notes: s.notes ?? '',
  }
}

export const PAYMENT_TERMS = ['Prepaid', 'Credit card', 'Due on receipt', 'Net 15', 'Net 30', 'Net 45', 'Net 60']

function Ingredients({ items }: { items: SupplierIngredient[] }) {
  return (
    <Section
      title={`Ingredients${items.length ? ` (${items.length})` : ''}`}
      description="Library ingredients sourced from this supplier, or that name it in their Supplier field."
    >
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">
          No ingredients yet. Link one from an ingredient&apos;s Suppliers section, or enter this supplier&apos;s name in its Supplier field.
        </p>
      ) : (
        <div className="overflow-x-auto -mx-4 sm:-mx-5">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 border-y border-gray-100 bg-gray-50">
              <tr>
                <th className="px-4 sm:px-5 py-2 text-left font-medium">Ingredient</th>
                <th className="px-3 py-2 text-left font-medium">Brand / item code</th>
                <th className="px-3 py-2 text-left font-medium"><Term t="packSize">Pack</Term></th>
                <th className="px-4 sm:px-5 py-2 text-right font-medium">
                  <Term tip="This supplier’s price per pack unit, recorded on the ingredient’s Suppliers tab. Change it there.">Cost</Term>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(i => (
                <tr key={i.id}>
                  <td className="px-4 sm:px-5 py-2">
                    <Link href={`/ingredients/${i.id}`} className="text-gray-900 hover:text-blue-700 hover:underline">{i.name}</Link>
                    {i.link?.isPreferred && (
                      <span className="ml-2 inline-flex px-1.5 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700">
                        <Term t="preferredSupplier">Preferred</Term>
                      </span>
                    )}
                    {!i.link && (
                      <span className="ml-2 inline-flex px-1.5 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-500">
                        <Term tip="This ingredient names the supplier in its Supplier field but isn’t linked, so it has no pack size or cost here.">Named</Term>
                      </span>
                    )}
                    {i.category && <div className="text-xs text-gray-400">{i.category}</div>}
                  </td>
                  <td className="px-3 py-2 text-gray-600 text-xs">
                    {[i.brandName, i.itemCode].filter(Boolean).join(' · ') || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2 text-gray-600 text-xs tabular-nums">
                    {i.link?.packSize
                      ? `${parseFloat(i.link.packSize)} ${i.link.packUnit ?? ''}`
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 sm:px-5 py-2 text-right text-gray-700 text-xs tabular-nums">
                    {i.link?.costPerUnit
                      ? `$${parseFloat(i.link.costPerUnit).toFixed(2)} / ${i.link.packUnit || 'unit'}`
                      : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}

function SupplierForm({ supplier, canEdit }: { supplier: SupplierDetailData; canEdit: boolean }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const initial = toForm(supplier)
  const [form, setForm] = useState<Form>(initial)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const dirty = JSON.stringify(form) !== JSON.stringify(initial)
  const ro = !canEdit
  const hasLinks = supplier.ingredients.some(i => i.link)

  const text = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const save = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/suppliers/${supplier.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, name: form.name.trim() }),
      })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not save supplier'))
      return (await r.json()) as { renamedIngredients: number }
    },
    onSuccess: ({ renamedIngredients }) => {
      queryClient.invalidateQueries({ queryKey: ['supplier', supplier.id] })
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      if (renamedIngredients) {
        queryClient.invalidateQueries({ queryKey: ['ingredients'] })
        queryClient.invalidateQueries({ queryKey: ['ingredient'] })
      }
      toast.success(renamedIngredients
        ? `Supplier saved; ${renamedIngredients} ingredient${renamedIngredients === 1 ? '' : 's'} updated to the new name`
        : 'Supplier saved')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/suppliers/${supplier.id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not delete supplier'))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success(`${supplier.name} deleted`)
      router.push('/suppliers')
    },
    onError: (e: Error) => { toast.error(e.message); setConfirmDelete(false) },
  })

  return (
    // Not a <form>: the contact editor inside is one, and forms can't nest
    <div className="space-y-5 pb-20">
      <Section title="Details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Supplier name *" htmlFor="supplier-name" hint={ro ? undefined : 'Renaming also updates the Supplier text on ingredients that use the old name.'}>
            <input id="supplier-name" value={form.name} onChange={text('name')} disabled={ro} className={inputCls} />
          </Field>
          <Field label="Website" htmlFor="supplier-website">
            <div className="flex items-center gap-2">
              <input id="supplier-website" value={form.websiteUrl} onChange={text('websiteUrl')} disabled={ro} placeholder="https://" className={inputCls} />
              {supplier.websiteUrl && (
                <a href={supplier.websiteUrl} target="_blank" rel="noopener noreferrer" data-tip="Open the supplier’s website in a new tab"
                  aria-label="Open website" className="p-1.5 text-gray-400 hover:text-blue-600 shrink-0">
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </Field>
          <Field label="Main email" htmlFor="supplier-email">
            <input id="supplier-email" type="email" value={form.email} onChange={text('email')} disabled={ro} placeholder="orders@supplier.com" className={inputCls} />
          </Field>
          <Field label="Main phone" htmlFor="supplier-phone">
            <input id="supplier-phone" type="tel" value={form.phone} onChange={text('phone')} disabled={ro} className={inputCls} />
          </Field>
          <Field label="Our account #" htmlFor="supplier-account" term="accountNumber">
            <input id="supplier-account" value={form.accountNumber} onChange={text('accountNumber')} disabled={ro} className={inputCls} autoComplete="off" />
          </Field>
          <Field label="Payment terms" htmlFor="supplier-terms" term="paymentTerms">
            <input id="supplier-terms" list="supplier-payment-terms" value={form.paymentTerms} onChange={text('paymentTerms')} disabled={ro} placeholder="e.g. Net 30" className={inputCls} />
            <datalist id="supplier-payment-terms">{PAYMENT_TERMS.map(t => <option key={t} value={t} />)}</datalist>
          </Field>
        </div>
        <h3 className="text-xs font-semibold text-gray-700 mt-5 mb-2">Address</h3>
        <AddressFields prefix="supplier" value={form.address} onChange={address => setForm(f => ({ ...f, address }))} disabled={ro} />
        <div className="mt-3">
          <Field label="Notes" htmlFor="supplier-notes">
            <textarea id="supplier-notes" value={form.notes} onChange={text('notes')} disabled={ro} rows={3}
              placeholder="Lead times, MOQs, shipping cutoffs…" className={`${inputCls} resize-y`} />
          </Field>
        </div>
      </Section>

      <Contacts
        endpoint={`/api/suppliers/${supplier.id}/contacts`}
        contacts={supplier.contacts}
        description="Sales reps, customer service, QA and anyone else you deal with."
        readOnly={ro}
        onChange={() => {
          queryClient.invalidateQueries({ queryKey: ['supplier', supplier.id] })
          queryClient.invalidateQueries({ queryKey: ['suppliers'] })
        }}
      />

      <Ingredients items={supplier.ingredients} />

      {canEdit && (
        <Section title="Delete supplier">
          {hasLinks ? (
            <p className="text-sm text-gray-500">
              A supplier linked to ingredients can&apos;t be deleted. Remove it from those ingredients first.
            </p>
          ) : confirmDelete ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-700">Delete {supplier.name} and its contacts?</span>
              <button type="button" onClick={() => remove.mutate()} disabled={remove.isPending}
                data-tip="Permanently deletes this supplier and all its contacts. This can’t be undone."
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
              data-tip="Deletes this supplier and its contacts. You’ll be asked to confirm."
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-md hover:bg-red-50">
              <Trash2 size={14} /> Delete supplier
            </button>
          )}
        </Section>
      )}

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
            disabled={!form.name.trim() || save.isPending}
            data-tip={form.name.trim() ? 'Saves the supplier’s details and address. Contacts save on their own.' : 'Enter a supplier name first.'}
            className="px-3 py-1.5 text-sm bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  )
}

export function SupplierDetail({ id, canEdit }: { id: string; canEdit: boolean }) {
  const router = useRouter()
  const { data, isLoading, isError } = useQuery<SupplierDetailData>({
    queryKey: ['supplier', id],
    queryFn: async () => {
      const r = await fetch(`/api/suppliers/${id}`)
      if (!r.ok) throw new Error('Not found')
      return r.json()
    },
  })

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-4xl">
      <button
        onClick={() => router.push('/suppliers')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6"
      >
        <ArrowLeft size={14} /> Suppliers
      </button>
      {isLoading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : isError || !data ? (
        <p className="text-sm text-red-500">Supplier not found.</p>
      ) : (
        <>
          <h1 className="text-2xl font-semibold text-gray-900 mb-6">{data.name}</h1>
          {/* Keyed on the saved record, so the form resets after a save that changes it */}
          <SupplierForm key={JSON.stringify(toForm(data))} supplier={data} canEdit={canEdit} />
        </>
      )}
    </div>
  )
}
