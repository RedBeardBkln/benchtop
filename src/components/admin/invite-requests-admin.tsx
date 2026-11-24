'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { readErrorMessage } from '@/lib/utils'
import { Card, formatDate } from '@/components/settings/ui'
import {
  INVITE_COMPANY_TYPE_LABELS, INVITE_TEAM_SIZE_LABELS, inviteNoteFor,
  type InviteCompanyType, type InviteRequestStatus, type InviteTeamSize,
} from '@/lib/invite-requests'

export const NEW_INVITE_REQUESTS_KEY = ['admin-invite-requests-new']

// How many beta requests are waiting, for platform admins; 0 for everyone else (never fetched)
export function useNewInviteRequests(enabled: boolean): number {
  const { data } = useQuery<{ count: number }>({
    queryKey: NEW_INVITE_REQUESTS_KEY,
    queryFn: async () => {
      const r = await fetch('/api/admin/invite-requests?count=new')
      if (!r.ok) throw new Error('Could not load invite requests')
      return r.json()
    },
    enabled,
    staleTime: 60 * 1000,
  })
  return enabled ? data?.count ?? 0 : 0
}

type InviteRequest = {
  id: string
  name: string
  email: string
  company: string | null
  role: string | null
  companyType: InviteCompanyType | null
  teamSize: InviteTeamSize | null
  message: string | null
  referral: string | null
  status: InviteRequestStatus
  createdAt: string
  reviewedAt: string | null
}

const STATUS_CLS: Record<InviteRequestStatus, string> = {
  new: 'bg-blue-100 text-blue-800',
  invited: 'bg-green-100 text-green-800',
  declined: 'bg-gray-100 text-gray-600',
}

// Beta requests from the public site. "Invite" fills in the invitation form above; creating the
// invitation marks the request invited (server side).
export function InviteRequestsAdmin({
  reloadKey,
  onInvite,
  approveRequestId,
}: {
  reloadKey: number
  onInvite: (email: string, note: string) => void
  /** From the Approve link in the notification email: fill this request into the invite form once */
  approveRequestId?: string
}) {
  const queryClient = useQueryClient()
  const [requests, setRequests] = useState<InviteRequest[] | null>(null)
  const [showAll, setShowAll] = useState(false)
  const approveHandled = useRef(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/invite-requests')
    if (!res.ok) return toast.error(await readErrorMessage(res, 'Could not load invite requests'))
    setRequests(await res.json())
    queryClient.invalidateQueries({ queryKey: NEW_INVITE_REQUESTS_KEY })
  }, [queryClient])

  useEffect(() => {
    load()
  }, [load, reloadKey])

  useEffect(() => {
    if (!approveRequestId || requests === null || approveHandled.current) return
    approveHandled.current = true
    const r = requests.find(x => x.id === approveRequestId)
    if (!r) return void toast.error('That request was not found')
    if (r.status !== 'new') {
      setShowAll(true)
      return void toast.info(`The request from ${r.email} is already ${r.status}`)
    }
    onInvite(r.email, inviteNoteFor(r))
    toast.success(`Approving ${r.name}: choose the account type, then create the invitation`)
  }, [approveRequestId, requests, onInvite])

  async function setStatus(id: string, status: InviteRequestStatus) {
    const res = await fetch(`/api/admin/invite-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) return toast.error(await readErrorMessage(res, 'Could not update the request'))
    load()
  }

  const waiting = requests?.filter(r => r.status === 'new') ?? []
  const shown = showAll ? requests ?? [] : waiting

  return (
    <Card
      title={`Beta requests${waiting.length ? ` (${waiting.length} waiting)` : ''}`}
      description="Sent from the request form on the public site. Each new request is emailed to Benchtop; nothing is sent to the requester."
    >
      {requests === null ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-gray-500">{showAll ? 'No requests yet.' : 'No requests waiting.'}</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {shown.map(r => (
            <li key={r.id} className="py-3 first:pt-0">
              <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-gray-900">
                    <span className="font-medium">{r.name}</span>{' '}
                    <a href={`mailto:${r.email}`} className="text-blue-600 hover:underline">{r.email}</a>
                  </div>
                  <div className="text-xs text-gray-500">
                    {[
                      r.role,
                      r.company,
                      r.companyType && INVITE_COMPANY_TYPE_LABELS[r.companyType],
                      r.teamSize && INVITE_TEAM_SIZE_LABELS[r.teamSize],
                      formatDate(r.createdAt),
                    ].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLS[r.status]}`}>
                  {r.status}
                </span>
              </div>
              {r.message && <p className="mt-1.5 text-sm text-gray-700 whitespace-pre-wrap">{r.message}</p>}
              {r.referral && <p className="mt-1 text-xs text-gray-500">Heard about us: {r.referral}</p>}
              <div className="mt-2 flex gap-4 text-xs">
                {r.status === 'new' ? (
                  <>
                    <button type="button" onClick={() => onInvite(r.email, inviteNoteFor(r))} className="font-medium text-blue-700 hover:underline"
                      data-tip="Fills in the invitation form with this email. The request is marked invited once you create it.">
                      Invite
                    </button>
                    <button type="button" onClick={() => setStatus(r.id, 'declined')} className="text-gray-600 hover:underline"
                      data-tip="Takes it off the waiting list. Nothing is sent to them.">
                      Decline
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => setStatus(r.id, 'new')} className="text-gray-600 hover:underline">
                    Move back to waiting
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {requests !== null && requests.length > waiting.length && (
        <button type="button" onClick={() => setShowAll(v => !v)} className="mt-3 text-xs text-gray-600 hover:underline">
          {showAll ? 'Show only waiting requests' : `Show all ${requests.length} requests`}
        </button>
      )}
    </Card>
  )
}
