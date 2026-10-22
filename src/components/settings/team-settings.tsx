'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Copy } from 'lucide-react'
import { readErrorMessage } from '@/lib/utils'
import { DEFAULT_MEMBER_ACCESS, summarizeAccess, type MemberAccess } from '@/lib/team-access'
import { formatSeatPrice, SEAT_PRICE_USD, type SeatInterval } from '@/lib/billing/seats'
import { AccessEditor, type ProjectOption } from './access-editor'
import { btnPrimary, btnSecondary, Card, Field, formatDate, inputCls, Notice } from './ui'

type TeamRole = 'owner' | 'admin' | 'member'
type SeatState = 'exempt' | 'dev_bypass' | 'ready' | 'not_configured' | 'no_subscription'

type Team = {
  me: string
  members: Array<{
    userId: string
    email: string | null
    fullName: string | null
    role: TeamRole
    access: MemberAccess | null
    createdAt: string
  }>
  invitations: Array<{
    id: string
    email: string
    role: 'admin' | 'member' | null
    access: MemberAccess | null
    createdAt: string
    expiresAt: string
  }>
  projects: ProjectOption[]
  clients: string[]
  seats: { state: SeatState; used: number; billed: number; interval: SeatInterval | null }
}

const ROLE_LABEL: Record<TeamRole, string> = { owner: 'Owner', admin: 'Admin', member: 'Member' }
const ROLE_CLS: Record<TeamRole, string> = {
  owner: 'bg-gray-900 text-white',
  admin: 'bg-blue-100 text-blue-800',
  member: 'bg-gray-100 text-gray-700',
}

const PRICE_TEXT = `$${SEAT_PRICE_USD.month} per month or $${SEAT_PRICE_USD.year} per year`

function RoleSelect({ value, onChange, id }: { value: 'admin' | 'member'; onChange: (v: 'admin' | 'member') => void; id: string }) {
  return (
    <select id={id} value={value} onChange={e => onChange(e.target.value as 'admin' | 'member')} className={inputCls}>
      <option value="member">Member — only the projects and clients you choose</option>
      <option value="admin">Admin — everything, including team and access</option>
    </select>
  )
}

export function TeamSettings() {
  const [team, setTeam] = useState<Team | null>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'member'>('member')
  const [access, setAccess] = useState<MemberAccess>(DEFAULT_MEMBER_ACCESS)
  const [inviting, setInviting] = useState(false)
  const [link, setLink] = useState<{ email: string; url: string } | null>(null)
  const [editing, setEditing] = useState<{ userId: string; role: 'admin' | 'member'; access: MemberAccess } | null>(null)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/team')
    if (!res.ok) return toast.error(await readErrorMessage(res, 'Could not load your team'))
    setTeam(await res.json())
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function invite(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    setLink(null)
    const res = await fetch('/api/team/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role, access: role === 'member' ? access : undefined }),
    })
    setInviting(false)
    if (!res.ok) return toast.error(await readErrorMessage(res, 'Could not create the invitation'))
    const body = await res.json()
    setLink({ email: body.email, url: body.url })
    setEmail('')
    setRole('member')
    setAccess(DEFAULT_MEMBER_ACCESS)
    load()
  }

  async function revoke(id: string) {
    if (!window.confirm('Revoke this invitation? The link will stop working.')) return
    const res = await fetch(`/api/team/invitations/${id}`, { method: 'DELETE' })
    if (!res.ok) return toast.error(await readErrorMessage(res, 'Could not revoke the invitation'))
    toast.success('Invitation revoked')
    load()
  }

  async function saveMember() {
    if (!editing) return
    setSaving(true)
    const res = await fetch(`/api/team/members/${editing.userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: editing.role, access: editing.role === 'member' ? editing.access : undefined }),
    })
    setSaving(false)
    if (!res.ok) return toast.error(await readErrorMessage(res, 'Could not save access'))
    toast.success('Access updated')
    setEditing(null)
    load()
  }

  async function remove(member: Team['members'][number]) {
    const who = member.fullName || member.email || 'this person'
    if (!window.confirm(`Remove ${who} from the team? Their login is deleted and they lose access immediately. Their work stays in the account.`)) return
    const res = await fetch(`/api/team/members/${member.userId}`, { method: 'DELETE' })
    if (!res.ok) return toast.error(await readErrorMessage(res, 'Could not remove the member'))
    const body = await res.json()
    if (body.seatSync && !body.seatSync.ok) toast.warning(`${who} was removed, but billing could not be updated yet. Use “Update billing” below.`)
    else toast.success(`${who} was removed`)
    if (editing?.userId === member.userId) setEditing(null)
    load()
  }

  async function resync() {
    setSyncing(true)
    const res = await fetch('/api/team/seats', { method: 'POST' })
    setSyncing(false)
    if (!res.ok) return toast.error(await readErrorMessage(res, 'Could not update billing'))
    toast.success('Billing updated')
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

  if (!team) {
    return (
      <Card title="Team">
        <p className="text-sm text-gray-500">Loading…</p>
      </Card>
    )
  }

  const { seats } = team
  const canInvite = seats.state === 'exempt' || seats.state === 'dev_bypass' || seats.state === 'ready'
  const seatPrice = seats.interval ? formatSeatPrice(seats.interval) : null

  return (
    <>
      <Card title="Team seats" description={`Your plan includes you. Each additional user is ${PRICE_TEXT}.`}>
        <div className="space-y-3 text-sm">
          {seats.state === 'exempt' && (
            <Notice tone="success">This is an internal account, so additional users are free.</Notice>
          )}
          {seats.state === 'dev_bypass' && (
            <Notice tone="info">Developer bypass is on (BILLING_DEV_BYPASS), so seats are not billed here. This has no effect in production.</Notice>
          )}
          {seats.state === 'no_subscription' && (
            <Notice tone="warning">Start a subscription on the Billing page before adding team members.</Notice>
          )}
          {seats.state === 'not_configured' && (
            <Notice tone="warning">Team seat billing is not configured in this environment, so team members cannot be added.</Notice>
          )}
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3">
            <div>
              <dt className="text-gray-500">Additional users</dt>
              <dd className="text-gray-900">{seats.used}</dd>
            </div>
            {seats.state === 'ready' && seatPrice && (
              <>
                <div>
                  <dt className="text-gray-500">Price per user</dt>
                  <dd className="text-gray-900">{seatPrice}, matching your plan</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Seats cost</dt>
                  <dd className="text-gray-900">
                    ${SEAT_PRICE_USD[seats.interval!] * seats.used}/{seats.interval}
                  </dd>
                </div>
              </>
            )}
          </dl>
          {seats.state === 'ready' && seats.billed !== seats.used && (
            <Notice tone="warning">
              <div className="flex flex-wrap items-center gap-3">
                <span>
                  Your subscription bills {seats.billed} additional user{seats.billed === 1 ? '' : 's'}, but the team has {seats.used}.
                </span>
                <button type="button" onClick={resync} disabled={syncing} className={btnSecondary}>
                  {syncing ? 'Updating…' : 'Update billing'}
                </button>
              </div>
            </Notice>
          )}
        </div>
      </Card>

      <Card title="Invite a teammate">
        <form onSubmit={invite} className="space-y-4">
          <Field label="Email" htmlFor="teamInviteEmail">
            <input id="teamInviteEmail" type="email" required value={email} onChange={e => setEmail(e.target.value)} className={inputCls} disabled={!canInvite} />
          </Field>
          <Field label="Role" htmlFor="teamInviteRole">
            <RoleSelect id="teamInviteRole" value={role} onChange={setRole} />
          </Field>
          {role === 'member' && (
            <div className="rounded-md border border-gray-200 p-4">
              <AccessEditor value={access} onChange={setAccess} projects={team.projects} clients={team.clients} />
            </div>
          )}
          {seats.state === 'ready' && seatPrice && (
            <p className="text-xs text-gray-500">
              When they accept, {seatPrice} is added to your subscription (prorated for the current period).
            </p>
          )}
          <button type="submit" disabled={inviting || !canInvite} className={btnPrimary}>
            {inviting ? 'Creating…' : 'Create invitation'}
          </button>
        </form>

        {link && (
          <div className="mt-4 space-y-2">
            <Notice tone="success">
              Invitation created for {link.email}. This link is shown only once, so copy it now and send it to them. It expires in 7 days.
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

      <Card title="Members">
        <ul className="divide-y divide-gray-100">
          {team.members.map(m => {
            const isEditing = editing?.userId === m.userId
            const editable = m.role !== 'owner' && m.userId !== team.me
            return (
              <li key={m.userId} className="py-3">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">{m.fullName || m.email || 'Unknown user'}</span>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_CLS[m.role]}`}>{ROLE_LABEL[m.role]}</span>
                      {m.userId === team.me && <span className="text-xs text-gray-400">(you)</span>}
                    </div>
                    {m.fullName && m.email && <div className="text-xs text-gray-500 truncate">{m.email}</div>}
                    <div className="text-xs text-gray-500 mt-0.5">
                      {m.role === 'member' && m.access ? summarizeAccess(m.access) : 'Full access'}
                    </div>
                  </div>
                  {editable && !isEditing && (
                    <div className="flex gap-3 text-xs">
                      <button
                        type="button"
                        onClick={() =>
                          setEditing({
                            userId: m.userId,
                            role: m.role === 'admin' ? 'admin' : 'member',
                            access: m.access ?? DEFAULT_MEMBER_ACCESS,
                          })
                        }
                        className="text-blue-600 hover:underline"
                      >
                        Edit access
                      </button>
                      <button type="button" onClick={() => remove(m)} className="text-red-600 hover:underline">
                        Remove
                      </button>
                    </div>
                  )}
                </div>
                {isEditing && editing && (
                  <div className="mt-3 space-y-4 rounded-md border border-gray-200 p-4">
                    <Field label="Role" htmlFor={`role-${m.userId}`}>
                      <RoleSelect id={`role-${m.userId}`} value={editing.role} onChange={r => setEditing({ ...editing, role: r })} />
                    </Field>
                    {editing.role === 'member' && (
                      <AccessEditor
                        value={editing.access}
                        onChange={a => setEditing({ ...editing, access: a })}
                        projects={team.projects}
                        clients={team.clients}
                      />
                    )}
                    <div className="flex gap-3">
                      <button type="button" onClick={saveMember} disabled={saving} className={btnPrimary}>
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button type="button" onClick={() => setEditing(null)} disabled={saving} className={btnSecondary}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </Card>

      {team.invitations.length > 0 && (
        <Card title="Pending invitations" description="No seat is billed until the invitation is accepted.">
          <ul className="divide-y divide-gray-100">
            {team.invitations.map(i => (
              <li key={i.id} className="py-3 flex flex-wrap items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-900 truncate">{i.email}</span>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_CLS[i.role ?? 'member']}`}>
                      {ROLE_LABEL[i.role ?? 'member']}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {i.role === 'member' && i.access ? `${summarizeAccess(i.access)} · ` : ''}Expires {formatDate(i.expiresAt)}
                  </div>
                </div>
                <button type="button" onClick={() => revoke(i.id)} className="text-xs text-red-600 hover:underline">
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  )
}
