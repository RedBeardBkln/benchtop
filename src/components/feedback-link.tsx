'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { HelpCircle, MessageSquarePlus, X } from 'lucide-react'
import { FEEDBACK_KIND_LABELS, FEEDBACK_KINDS, FEEDBACK_MESSAGE_MAX, type FeedbackKind } from '@/lib/feedback'
import { readErrorMessage } from '@/lib/utils'
import { btnPrimary, btnSecondary, Field, inputCls } from '@/components/settings/ui'

type FeedbackContext = { eligible: boolean; contact: { name: string; email: string; phone: string } }

export const FEEDBACK_CONTEXT_KEY = ['feedback-context']

// Foot of every page: a link to Help, and "Report a bug or request a feature", which is only shown
// once the user's profile is complete, so every submission has someone to reply to.
export function FeedbackLink() {
  const [open, setOpen] = useState(false)
  const { data } = useQuery<FeedbackContext>({
    queryKey: FEEDBACK_CONTEXT_KEY,
    queryFn: async () => {
      const r = await fetch('/api/feedback')
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not load feedback'))
      return r.json()
    },
    staleTime: 5 * 60 * 1000,
  })

  return (
    <footer className="px-4 sm:px-8 py-6 flex flex-wrap items-center gap-x-5 gap-y-2 print:hidden">
      <Link
        href="/help"
        className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition-colors"
      >
        <HelpCircle size={14} />
        Help & FAQ
      </Link>
      {data?.eligible && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-tip="Send a bug report or feature request to the benchtop team. The page you’re on is included."
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition-colors"
        >
          <MessageSquarePlus size={14} />
          Report a bug or request a feature
        </button>
      )}
      {open && data && <FeedbackDialog contact={data.contact} onClose={() => setOpen(false)} />}
    </footer>
  )
}

// Rendered only while open, so the form starts fresh each time
function FeedbackDialog({ contact, onClose }: { contact: FeedbackContext['contact']; onClose: () => void }) {
  const pathname = usePathname()
  const [kind, setKind] = useState<FeedbackKind>('bug')
  const [name, setName] = useState(contact.name)
  const [email, setEmail] = useState(contact.email)
  const [phone, setPhone] = useState(contact.phone)
  const [message, setMessage] = useState('')
  const [wantsContact, setWantsContact] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind, message, contactName: name, contactEmail: email, contactPhone: phone, wantsContact, pagePath: pathname,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const body = await res.clone().json().catch(() => null)
      if (body?.fields) {
        setErrors(Object.fromEntries(Object.entries(body.fields as Record<string, string[]>).map(([k, v]) => [k, v?.[0]])))
      }
      toast.error(await readErrorMessage(res, 'Could not send your feedback'))
      return
    }
    toast.success(kind === 'bug' ? 'Thanks, your bug report was sent' : 'Thanks, your feature request was sent')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (e.key === 'Escape') onClose() }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-full overflow-y-auto p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 id="feedback-title" className="text-base font-semibold text-gray-900">Report a bug or request a feature</h3>
            <p className="text-sm text-gray-500 mt-0.5">Goes straight to the benchtop team.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" data-tip="Close without sending" className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-2" role="radiogroup" aria-label="Type">
          {FEEDBACK_KINDS.map(k => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={`flex-1 py-1.5 text-sm rounded-md border transition-colors ${
                kind === k ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {FEEDBACK_KIND_LABELS[k]}
            </button>
          ))}
        </div>

        <Field
          label={kind === 'bug' ? 'What happened?' : 'What would you like benchtop to do?'}
          htmlFor="feedback-message"
          error={errors.message}
          hint={kind === 'bug' ? 'What you did, what you expected, and what you saw instead.' : undefined}
        >
          <textarea
            id="feedback-message"
            required
            autoFocus
            rows={5}
            maxLength={FEEDBACK_MESSAGE_MAX}
            value={message}
            onChange={e => setMessage(e.target.value)}
            className={inputCls}
          />
        </Field>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-gray-700 mb-2">Your contact details</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Name" htmlFor="feedback-name" error={errors.contactName}>
              <input id="feedback-name" required maxLength={120} value={name} onChange={e => setName(e.target.value)} className={inputCls} autoComplete="name" />
            </Field>
            <Field label="Phone" htmlFor="feedback-phone" error={errors.contactPhone}>
              <input id="feedback-phone" maxLength={30} value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} autoComplete="tel" placeholder="Optional" />
            </Field>
          </div>
          <Field label="Email" htmlFor="feedback-email" error={errors.contactEmail}>
            <input id="feedback-email" type="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} className={inputCls} autoComplete="email" />
          </Field>
        </fieldset>

        <label className="flex items-start gap-2 text-sm text-gray-700"
          data-tip="Tick if you’d like the benchtop team to get back to you about this">
          <input
            type="checkbox"
            checked={wantsContact}
            onChange={e => setWantsContact(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Contact me about this submission
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
          <button type="submit" disabled={saving || !message.trim()} className={btnPrimary}
            data-tip={message.trim() ? 'Sends this to the benchtop team, with the page you were on' : 'Describe it first.'}>
            {saving ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  )
}
