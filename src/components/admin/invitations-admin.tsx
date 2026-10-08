'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Copy } from 'lucide-react'
import { readErrorMessage } from '@/lib/utils'
import { btnPrimary, btnSecondary, Card, Field, formatDate, inputCls, Notice } from '@/components/settings/ui'

type Invite = {
  id: string
  email: string
  note: string | null
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
  createdAt: string
  expiresAt: string
  acceptedAt: string | null
}

const STATUS_CLS: Record<Invite['status'], string> = {
  pending: 'bg-blue-100 text-blue-800',
  accepted: 'bg-green-100 text-green-800',
  expired: 'bg-gray-100 text-gray-600',
  revoked: 'bg-red-100 text-red-700',
}

export function InvitationsAdmin() {
  const [invites, setInvites] = useState<Invite[] | null>(null)
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [days, setDays] = useState('7')
  const [creating, setCreating] = useState(false)
  const [link, setLink] = useState<{ email: string; url: string } | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/invitations')
    if (!res.ok) return toast.error(await readErrorMessage(res, 'Could not load invitations'))
    setInvites(await res.json())
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setLink(null)
    const res = await fetch('/api/admin/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, note: note || undefined, expiresInDays: Number(days) || undefined }),
    })
    setCreating(false)
    if (!res.ok) return toast.error(await readErrorMessage(res, 'Could not create the invitation'))
    const body = await res.json()
    setLink({ email: body.email, url: body.url })
    setEmail('')
    setNote('')
    load()
  }

  async function revoke(id: string) {
    if (!window.confirm('Revoke this invitation? The link will stop working.')) return
    const res = await fetch(`/api/admin/invitations/${id}`, { method: 'DELETE' })
    if (!res.ok) return toast.error(await readErrorMessage(res, 'Could not revoke the invitation'))
    toast.success('Invitation revoked')
    load()
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy; select the link and copy it manually')
    }
  }

  return (
    <div className="space-y-6">
      <Card title="Invite someone">
        <form onSubmit={create} className="space-y-3 max-w-lg">
          <Field label="Email" htmlFor="inviteEmail">
            <input id="inviteEmail" type="email" required value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Note (optional, only visible to admins)" htmlFor="inviteNote">
            <input id="inviteNote" maxLength={500} value={note} onChange={e => setNote(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Expires in (days)" htmlFor="inviteDays">
            <input id="inviteDays" type="number" min={1} max={60} value={days} onChange={e => setDays(e.target.value)} className={inputCls} />
          </Field>
          <button type="submit" disabled={creating} className={btnPrimary}>
            {creating ? 'Creating…' : 'Create invitation'}
          </button>
        </form>

        {link && (
          <div className="mt-4 space-y-2">
            <Notice tone="success">
              Invitation created for {link.email}. This link is shown only once, so copy it now and send it to them.
            </Notice>
            <div className="flex gap-2">
              <input readOnly value={link.url} onFocus={e => e.currentTarget.select()} className={`${inputCls} font-mono text-xs`} />
              <button type="button" onClick={() => copy(link.url)} className={btnSecondary}>
                <Copy size={14} className="mr-2" />
                Copy
              </button>
            </div>
          </div>
        )}
      </Card>

      <Card title="All invitations">
        {invites === null ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : invites.length === 0 ? (
          <p className="text-sm text-gray-500">No invitations yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-4 font-medium">Email</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Created</th>
                  <th className="py-2 pr-4 font-medium">Expires</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {invites.map(i => (
                  <tr key={i.id} className="border-b border-gray-100">
                    <td className="py-2 pr-4">
                      <div className="text-gray-900">{i.email}</div>
                      {i.note && <div className="text-xs text-gray-500">{i.note}</div>}
                    </td>
                    <td className="py-2 pr-4">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLS[i.status]}`}>
                        {i.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap">{formatDate(i.createdAt)}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{formatDate(i.expiresAt)}</td>
                    <td className="py-2 text-right">
                      {i.status === 'pending' && (
                        <button onClick={() => revoke(i.id)} className="text-xs text-red-600 hover:underline">
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
