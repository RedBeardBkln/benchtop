'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Edit2, Plus, Star, Trash2 } from 'lucide-react'
import type { ClientAddress } from '@/lib/client-schemas'
import { readErrorMessage } from '@/lib/utils'

// Form pieces shared by the client and supplier records: fields, sections, addresses and contacts.

export type Contact = {
  id: string
  name: string
  title: string | null
  email: string | null
  phone: string | null
  isPrimary: boolean
  notes: string | null
}

export const inputCls =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-600'

export function Field({ label, htmlFor, children, hint }: {
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

export function Section({ title, description, children, action }: {
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

export function AddressFields({ prefix, value, onChange, disabled }: {
  prefix: string
  value: ClientAddress
  onChange: (next: ClientAddress) => void
  disabled?: boolean
}) {
  const set = (k: keyof ClientAddress) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value })
  return (
    <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
      <div className="sm:col-span-6">
        <Field label="Street address" htmlFor={`${prefix}-line1`}>
          <input id={`${prefix}-line1`} value={value.line1} onChange={set('line1')} className={inputCls} autoComplete="off" disabled={disabled} />
        </Field>
      </div>
      <div className="sm:col-span-6">
        <Field label="Suite, unit, building (optional)" htmlFor={`${prefix}-line2`}>
          <input id={`${prefix}-line2`} value={value.line2} onChange={set('line2')} className={inputCls} autoComplete="off" disabled={disabled} />
        </Field>
      </div>
      <div className="sm:col-span-3">
        <Field label="City" htmlFor={`${prefix}-city`}>
          <input id={`${prefix}-city`} value={value.city} onChange={set('city')} className={inputCls} autoComplete="off" disabled={disabled} />
        </Field>
      </div>
      <div className="sm:col-span-1">
        <Field label="State / region" htmlFor={`${prefix}-region`}>
          <input id={`${prefix}-region`} value={value.region} onChange={set('region')} className={inputCls} autoComplete="off" disabled={disabled} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Postal code" htmlFor={`${prefix}-postal`}>
          <input id={`${prefix}-postal`} value={value.postalCode} onChange={set('postalCode')} className={inputCls} autoComplete="off" disabled={disabled} />
        </Field>
      </div>
      <div className="sm:col-span-6">
        <Field label="Country" htmlFor={`${prefix}-country`}>
          <input id={`${prefix}-country`} value={value.country} onChange={set('country')} className={inputCls} autoComplete="off" disabled={disabled} />
        </Field>
      </div>
    </div>
  )
}

export const emptyContact = { name: '', title: '', email: '', phone: '', notes: '', isPrimary: false }

export function ContactForm({ initial, onSave, onCancel, saving }: {
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
          <input id="contact-title" value={c.title} onChange={set('title')} placeholder="e.g. Sales, Purchasing, QA" className={inputCls} />
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

/**
 * The contacts on a record. `endpoint` is its contacts API (e.g. /api/clients/<id>/contacts);
 * `onChange` refreshes whatever shows them. Read-only hides the add / edit / remove actions.
 */
export function Contacts({ endpoint, contacts, description, onChange, readOnly }: {
  endpoint: string
  contacts: Contact[]
  description: string
  onChange: () => void
  readOnly?: boolean
}) {
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const refresh = onChange

  const save = useMutation({
    mutationFn: async ({ id, c }: { id: string | 'new'; c: typeof emptyContact }) => {
      const r = await fetch(id === 'new' ? endpoint : `${endpoint}/${id}`, {
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
      const r = await fetch(`${endpoint}/${id}`, {
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
      const r = await fetch(`${endpoint}/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not remove contact'))
    },
    onSuccess: () => { refresh(); toast.success('Contact removed') },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Section
      title="Contacts"
      description={description}
      action={!readOnly && editing === null && (
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
            {!readOnly && <div className="flex items-center gap-1 shrink-0">
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
            </div>}
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
