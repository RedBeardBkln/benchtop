'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Search, Truck, X } from 'lucide-react'
import type { Supplier } from '@/lib/types'
import { EMPTY_ADDRESS, type ClientAddress } from '@/lib/client-schemas'
import { shortAddress } from '@/lib/supplier-schemas'
import { readErrorMessage } from '@/lib/utils'
import { AddressFields, Field, emptyContact, inputCls } from '@/components/records/record-fields'
import { PAYMENT_TERMS } from './supplier-detail'
import { Term } from '@/components/term'
import { ArchivedRecords } from '@/components/archived-records'

type SupplierRow = Supplier & {
  ingredientCount: number
  primaryContact: { name: string; email: string | null; phone: string | null } | null
}

function NewSupplierDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [f, setF] = useState({ name: '', websiteUrl: '', email: '', phone: '', accountNumber: '', paymentTerms: '', notes: '' })
  const [address, setAddress] = useState<ClientAddress>(EMPTY_ADDRESS)
  const [contact, setContact] = useState({ ...emptyContact })

  const text = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF(prev => ({ ...prev, [k]: e.target.value }))
  const contactText = (k: 'name' | 'title' | 'email' | 'phone') => (e: React.ChangeEvent<HTMLInputElement>) =>
    setContact(prev => ({ ...prev, [k]: e.target.value }))
  // A contact needs a name; the other contact fields alone aren't enough to save one
  const contactStarted = !!(contact.title.trim() || contact.email.trim() || contact.phone.trim())
  const contactIncomplete = contactStarted && !contact.name.trim()

  const create = useMutation({
    mutationFn: async () => {
      const { isPrimary: _, ...c } = contact
      const r = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...f,
          name: f.name.trim(),
          address,
          contact: c.name.trim() ? { ...c, name: c.name.trim() } : null,
        }),
      })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not add supplier'))
      return (await r.json()) as { id: string; name: string }
    },
    onSuccess: s => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success(`Supplier "${s.name}" added`)
      router.push(`/suppliers/${s.id}`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/40 overflow-y-auto py-6">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">New supplier</h3>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <form
          className="px-5 py-4 space-y-5"
          onSubmit={e => { e.preventDefault(); if (f.name.trim() && !contactIncomplete) create.mutate() }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Company / vendor name *" htmlFor="new-supplier-name">
              <input id="new-supplier-name" autoFocus value={f.name} onChange={text('name')}
                placeholder="e.g. Cargill, Kerry Group, AIDP" className={inputCls} />
            </Field>
            <Field label="Website" htmlFor="new-supplier-website">
              <input id="new-supplier-website" value={f.websiteUrl} onChange={text('websiteUrl')} placeholder="https://" className={inputCls} />
            </Field>
            <Field label="Main email" htmlFor="new-supplier-email">
              <input id="new-supplier-email" type="email" value={f.email} onChange={text('email')} placeholder="orders@supplier.com" className={inputCls} />
            </Field>
            <Field label="Main phone" htmlFor="new-supplier-phone">
              <input id="new-supplier-phone" type="tel" value={f.phone} onChange={text('phone')} className={inputCls} />
            </Field>
            <Field label="Our account #" htmlFor="new-supplier-account" term="accountNumber">
              <input id="new-supplier-account" value={f.accountNumber} onChange={text('accountNumber')} className={inputCls} autoComplete="off" />
            </Field>
            <Field label="Payment terms" htmlFor="new-supplier-terms" term="paymentTerms">
              <input id="new-supplier-terms" list="new-supplier-payment-terms" value={f.paymentTerms} onChange={text('paymentTerms')}
                placeholder="e.g. Net 30" className={inputCls} />
              <datalist id="new-supplier-payment-terms">{PAYMENT_TERMS.map(t => <option key={t} value={t} />)}</datalist>
            </Field>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-gray-700 mb-2">Address</h4>
            <AddressFields prefix="new-supplier" value={address} onChange={setAddress} />
          </div>

          <div>
            <h4 className="text-xs font-semibold text-gray-700 mb-2">
              <Term tip="Your main person at this supplier. Optional; if you fill in any contact field, a name is needed.">Primary contact</Term>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Name" htmlFor="new-supplier-contact-name">
                <input id="new-supplier-contact-name" value={contact.name} onChange={contactText('name')} className={inputCls} />
              </Field>
              <Field label="Title / role" htmlFor="new-supplier-contact-title">
                <input id="new-supplier-contact-title" value={contact.title} onChange={contactText('title')} placeholder="e.g. Sales rep" className={inputCls} />
              </Field>
              <Field label="Email" htmlFor="new-supplier-contact-email">
                <input id="new-supplier-contact-email" type="email" value={contact.email} onChange={contactText('email')} className={inputCls} />
              </Field>
              <Field label="Phone" htmlFor="new-supplier-contact-phone">
                <input id="new-supplier-contact-phone" type="tel" value={contact.phone} onChange={contactText('phone')} className={inputCls} />
              </Field>
            </div>
            {contactIncomplete && <p className="mt-1 text-xs text-amber-700">Add the contact&apos;s name, or clear the contact fields.</p>}
            <p className="mt-1 text-xs text-gray-400">You can add more contacts after saving.</p>
          </div>

          <Field label="Notes" htmlFor="new-supplier-notes">
            <textarea id="new-supplier-notes" value={f.notes} onChange={text('notes')} rows={2}
              placeholder="Lead times, MOQs, shipping cutoffs…" className={`${inputCls} resize-y`} />
          </Field>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!f.name.trim() || contactIncomplete || create.isPending}
              data-tip={!f.name.trim()
                ? 'Enter the company name first.'
                : contactIncomplete
                  ? 'Add the contact’s name, or clear the contact fields.'
                  : 'Adds the supplier and opens its record. Names must be unique.'}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {create.isPending ? 'Adding…' : 'Add supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function SupplierList({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [query, setQuery] = useState('')

  const { data, isLoading } = useQuery<SupplierRow[]>({
    queryKey: ['suppliers'],
    queryFn: () => fetch('/api/suppliers').then(r => r.json()),
  })

  const q = query.trim().toLowerCase()
  const rows = (data ?? []).filter(s => !q || [s.name, s.primaryContact?.name, s.email, shortAddress(s.address)]
    .some(v => v?.toLowerCase().includes(q)))

  return (
    <div className="px-4 py-5 sm:px-8 sm:py-8 max-w-5xl">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Suppliers</h1>
          <p className="text-sm text-gray-500 mt-0.5">Vendors and distributors used across your ingredient library</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setDialogOpen(true)}
            data-tip="Add a company you buy ingredients from, with its contacts and terms"
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors shrink-0"
          >
            <Plus size={14} /> New supplier
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : !data?.length ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-white p-12 text-center">
          <Truck size={28} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-400">No suppliers yet.</p>
          {canEdit && (
            <button onClick={() => setDialogOpen(true)} className="mt-2 text-sm text-blue-600 hover:underline">
              Add your first supplier →
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="relative mb-3 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search suppliers, contacts, locations…"
              aria-label="Search suppliers"
              data-tip="Finds suppliers by name, contact name, email, or city, state or country"
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium"><Term t="supplier">Supplier</Term></th>
                    <th className="px-4 py-3 text-left font-medium">
                      <Term tip="The primary contact, with their email and phone (or the supplier’s main ones if they have none)">Contact</Term>
                    </th>
                    <th className="px-4 py-3 text-left font-medium">Location</th>
                    <th className="px-4 py-3 text-right font-medium">
                      <Term tip="How many library ingredients come from this supplier">Ingredients</Term>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map(s => {
                    const email = s.primaryContact?.email ?? s.email
                    const phone = s.primaryContact?.phone ?? s.phone
                    return (
                      <tr
                        key={s.id}
                        onClick={() => router.push(`/suppliers/${s.id}`)}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <Link href={`/suppliers/${s.id}`} onClick={e => e.stopPropagation()}
                            className="font-medium text-gray-900 hover:text-blue-700 hover:underline">
                            {s.name}
                          </Link>
                          {s.websiteUrl && (
                            <div className="text-xs text-gray-400 truncate max-w-[220px]">
                              {s.websiteUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {s.primaryContact && <div className="text-sm text-gray-800">{s.primaryContact.name}</div>}
                          {email && <div className="truncate max-w-[240px]">{email}</div>}
                          {phone && <div>{phone}</div>}
                          {!s.primaryContact && !email && !phone && <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {shortAddress(s.address) || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                          {s.ingredientCount || <span className="text-gray-300">0</span>}
                        </td>
                      </tr>
                    )
                  })}
                  {rows.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-400">No suppliers match “{query}”.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <ArchivedRecords kind="suppliers" canEdit={canEdit} />

      {dialogOpen && <NewSupplierDialog onClose={() => setDialogOpen(false)} />}
    </div>
  )
}
