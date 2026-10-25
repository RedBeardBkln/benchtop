'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Copy } from 'lucide-react'
import { readErrorMessage } from '@/lib/utils'
import { DEFAULT_MEMBER_ACCESS, summarizeAccess, type MemberAccess } from '@/lib/team-access'
import { formatSeatPrice, SEAT_PRICE_USD, type SeatInterval } from '@/lib/billing/seats'
import { AccessEditor, type ProjectOption } from './access-editor'
import { btnPrimary, btnSecondary, Card, Field, formatDate, inputCls, Notice } from './ui'
import { Term } from '@/components/term'

type TeamRole = 'owner' | 'admin' | 'member'
type SeatState = 'exempt' | 'free' | 'dev_bypass' | 'ready' | 'not_configured' | 'no_subscription'

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
  seats: {
    state: SeatState
    used: number
    billed: number
    interval: SeatInterval | null
    cap: number | null
    pending: number
  }
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
    <select
      id={id}
      value={value}
      onChange={e => onChange(e.target.value as 'admin' | 'member')}
      data-tip="Member: sees only the projects and clients you choose. Admin: sees and edits everything and manages the team, but not billing."
      className={inputCls}
    >
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
  const [newOwner, setNewOwner] = useState('')
  const [transferring, setTransferring] = useState(false)

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

  async function transferOwnership() {
    const target = team?.members.find(m => m.userId === newOwner)
    if (!target) return
    const who = target.fullName || target.email || 'this person'
    if (!window.confirm(
      `Make ${who} the owner of this account? They will control billing, the subscription and account deletion. ` +
      'You will become an admin and keep full access to everything else. Only the new owner can undo this.',
    )) return
    setTransferring(true)
    const res = await fetch('/api/team/transfer-ownership', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: newOwner }),
    })
    setTransferring(false)
    if (!res.ok) return toast.error(await readErrorMessage(res, 'Could not transfer ownership'))
    toast.success(`${who} is now the account owner`)
    setNewOwner('')
    // The billing and account pages read the role on the server
    window.location.reload()
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
  const atCap = seats.cap != null && seats.used + seats.pending >= seats.cap
  const canInvite = (seats.state === 'exempt' || seats.state === 'free' || seats.state === 'dev_bypass' || seats.state === 'ready') && !atCap
  const seatPrice = seats.interval ? formatSeatPrice(seats.interval) : null

  return (
    <>
      <Card title="Team seats" description={`Your plan includes you. Each additional user is ${PRICE_TEXT}.`}>
        <div className="space-y-3 text-sm">
          {seats.state === 'exempt' && (
            <Notice tone="success">This is an internal account, so additional users are free.</Notice>
          )}
          {seats.state === 'free' && (
            <Notice tone="success">
              Additional users are free while your account is free or in its trial. Once you subscribe, they are billed as seats.
            </Notice>
          )}
          {seats.cap != null && (
            <Notice tone={atCap ? 'warning' : 'info'}>
              Your plan allows up to {seats.cap} additional user{seats.cap === 1 ? '' : 's'}
              {seats.pending > 0 ? `, counting ${seats.pending} pending invitation${seats.pending === 1 ? '' : 's'}` : ''}.
              {atCap && ' Remove a user or revoke an invitation to invite someone else.'}
            </Notice>
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
              <dt className="text-gray-500"><Term t="seat">Additional users</Term></dt>
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
                <button type="button" onClick={resync} disabled={syncing} className={btnSecondary}
                  data-tip="Sets the number of seats on your subscription to match your team. The change is prorated.">
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
            <input id="teamInviteEmail" type="email" required value={email} onChange={e => setEmail(e.target.value)} className={inputCls} disabled={!canInvite}
              data-tip="The invitation link works only for this email address. It can’t already have a Benchtop login." />
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
          <button type="submit" disabled={inviting || !canInvite} className={btnPrimary}
            data-tip={canInvite
              ? 'Creates a link the person can use to join your team. Nothing is emailed: you copy the link and send it.'
              : atCap
                ? 'Your plan’s user limit is reached. Remove a user or revoke an invitation first.'
                : seats.state === 'no_subscription'
                  ? 'Start a subscription on the Billing page first.'
                  : 'Team seat billing isn’t set up here, so people can’t be added.'}
          >
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
              <button type="button" onClick={() => copy(link.url)} className={btnSecondary}
                data-tip="Copies the link. Send it to them yourself by email or chat; it’s shown only once.">
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
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_CLS[m.role]}`}>
                        <Term t={m.role}>{ROLE_LABEL[m.role]}</Term>
                      </span>
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
                        data-tip="Change this person’s role and which projects, clients and library access they have"
                      >
                        Edit access
                      </button>
                      <button type="button" onClick={() => remove(m)} className="text-red-600 hover:underline"
                        data-tip="Removes them after you confirm. Their login is deleted and any paid seat comes off the bill; their work stays.">
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
                      <button type="button" onClick={saveMember} disabled={saving} className={btnPrimary}
                        data-tip="Saves the role and access. The change takes effect right away.">
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
                      <Term t={i.role ?? 'member'}>{ROLE_LABEL[i.role ?? 'member']}</Term>
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {i.role === 'member' && i.access ? `${summarizeAccess(i.access)} · ` : ''}Expires {formatDate(i.expiresAt)}
                  </div>
                </div>
                <button type="button" onClick={() => revoke(i.id)} className="text-xs text-red-600 hover:underline"
                  data-tip="Cancels this invitation after you confirm. The link stops working.">
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {team.members.find(m => m.userId === team.me)?.role === 'owner' && team.members.length > 1 && (
        <Card
          title="Transfer ownership"
          description="Hand the account to another team member, for example when you leave the company. You become an admin."
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[14rem]">
              <Field label="New owner" htmlFor="new-owner">
                <select id="new-owner" value={newOwner} onChange={e => setNewOwner(e.target.value)} className={inputCls}
                  data-tip="The person must already be on the team. Invite them first if they aren’t.">
                  <option value="">Choose a team member…</option>
                  {team.members.filter(m => m.userId !== team.me).map(m => (
                    <option key={m.userId} value={m.userId}>
                      {m.fullName ? `${m.fullName}${m.email ? ` (${m.email})` : ''}` : (m.email ?? 'Unknown user')}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <button type="button" onClick={transferOwnership} disabled={!newOwner || transferring} className={btnSecondary}
              data-tip={newOwner
                ? 'Makes them the owner after you confirm. You become an admin, and only they can transfer it back.'
                : 'Choose the new owner first.'}
            >
              {transferring ? 'Transferring…' : 'Transfer ownership'}
            </button>
          </div>
        </Card>
      )}
    </>
  )
}
