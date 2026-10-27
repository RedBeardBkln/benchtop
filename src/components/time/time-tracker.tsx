'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Clock, FileText, Pencil, Play, Plus, Square, Trash2 } from 'lucide-react'
import { readErrorMessage } from '@/lib/utils'
import {
  PERIODS, activityLabel, durationMinutes, formatDuration, formatHours, localDayEnd, localDayStart, periodRange,
  splitLocal, summarizeEntries, type BilledFilter, type Period,
} from '@/lib/time-tracking'
import { Term } from '@/components/term'
import { fieldCls, useTimeEntries, useTimeOptions, type TimeEntryRow } from './use-time'
import { TimeEntryDialog, type EntryDialogMode } from './time-entry-dialog'
import { TimeReportDialog } from './time-report-dialog'

// The Time page: a running timer (if any), filters, totals and the list of logged time, with
// billed ticks, bulk billing and the way into a client's time report.

const smallSelect = `${fieldCls} !w-auto !py-1.5`

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

function useNow(enabled: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [enabled])
  return now
}

function RunningTimer({ entry, onEdit }: { entry: TimeEntryRow; onEdit: () => void }) {
  const queryClient = useQueryClient()
  const now = useNow(true)
  const secs = Math.max(0, Math.floor((now - new Date(entry.startedAt).getTime()) / 1000))
  const clock = `${Math.floor(secs / 3600)}:${String(Math.floor(secs / 60) % 60).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`

  const stop = useMutation({
    mutationFn: async () => {
      // At least a minute, so a timer stopped straight away still saves
      const end = Math.max(Date.now(), new Date(entry.startedAt).getTime() + 60_000)
      const r = await fetch(`/api/time-entries/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endedAt: new Date(end).toISOString() }),
      })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not stop the timer'))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] })
      toast.success('Timer stopped and time logged')
    },
    onError: (e: Error) => toast.error(`${e.message}. Use Edit to set the times by hand.`),
  })

  return (
    <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="font-mono text-xl tabular-nums text-blue-900" aria-label="Time running">{clock}</span>
      <div className="min-w-0 flex-1 text-sm">
        <div className="font-medium text-gray-900 truncate">
          {entry.clientName}{entry.projectName && <span className="text-gray-500"> · {entry.projectName}</span>}
        </div>
        <div className="text-gray-600 truncate">{activityLabel(entry.activity)} — {entry.task}</div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onEdit} className="px-3 py-1.5 text-sm border border-gray-300 bg-white rounded-md hover:bg-gray-50">
          Edit
        </button>
        <button
          onClick={() => stop.mutate()}
          disabled={stop.isPending}
          data-tip="Stops the timer and logs the time from when it started until now."
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
        >
          <Square size={12} fill="currentColor" /> {stop.isPending ? 'Stopping…' : 'Stop'}
        </button>
      </div>
    </div>
  )
}

export function TimeTracker({ isTeamAdmin }: { isTeamAdmin: boolean }) {
  const queryClient = useQueryClient()
  const { data: options } = useTimeOptions()
  const [dialog, setDialog] = useState<EntryDialogMode | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Filters
  const [clientId, setClientId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [billed, setBilled] = useState<BilledFilter>('all')
  const [person, setPerson] = useState('me')
  const [period, setPeriod] = useState<Period>('this-month')
  const thisMonth = periodRange('this-month')!
  const [from, setFrom] = useState(thisMonth.from)
  const [to, setTo] = useState(thisMonth.to)
  const range = period === 'custom' ? (from && to ? { from, to } : null) : periodRange(period)

  const params = useMemo(() => {
    const qs = new URLSearchParams({ billed, user: person })
    if (clientId) qs.set('client', clientId)
    if (projectId) qs.set('project', projectId)
    const f = range && localDayStart(range.from)
    const t = range && localDayEnd(range.to)
    if (f && t) { qs.set('from', f.toISOString()); qs.set('to', t.toISOString()) }
    return qs
  }, [billed, person, clientId, projectId, range?.from, range?.to]) // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading, isError } = useTimeEntries(params)
  const { data: runningData } = useTimeEntries(useMemo(() => new URLSearchParams({ user: 'me', running: '1' }), []))
  const running = runningData?.entries[0] ?? null

  const entries = useMemo(() => (data?.entries ?? []).filter(e => e.endedAt), [data])
  const totals = summarizeEntries(entries)
  const showPerson = isTeamAdmin && person !== 'me'
  const projects = (options?.projects ?? []).filter(p => p.clientId === clientId)

  // Selection only ever holds entries in view
  const visibleSelected = entries.filter(e => selected.has(e.id) && e.canEdit)
  const editable = entries.filter(e => e.canEdit)
  const allSelected = editable.length > 0 && visibleSelected.length === editable.length

  const setBilledFor = useMutation({
    mutationFn: async ({ ids, value }: { ids: string[]; value: boolean }) => {
      const r = await fetch('/api/time-entries/billed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, billed: value }),
      })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not update billed status'))
      return (await r.json()) as { updated: number }
    },
    onSuccess: (_res, { ids }) => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] })
      if (ids.length > 1) setSelected(new Set())
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/time-entries/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not delete the entry'))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] })
      toast.success('Time entry deleted')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Time</h1>
          <p className="text-sm text-gray-500 mt-0.5">Billable time for your clients, and time reports to send them.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setReportOpen(true)}
            data-tip="Builds a report of one client’s time that you can save as a PDF or download as a spreadsheet."
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 bg-white rounded-md hover:bg-gray-50"
          >
            <FileText size={14} /> Prepare report
          </button>
          <button
            onClick={() => setDialog({ kind: 'timer', clientId: clientId || null })}
            disabled={!!running}
            data-tip={running ? 'You already have a timer running. Stop it first.' : 'Starts a clock now; stop it when you finish and the time is logged.'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 bg-white rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            <Play size={14} /> Start timer
          </button>
          <button
            onClick={() => setDialog({ kind: 'log', clientId: clientId || null })}
            data-tip="Enter time you’ve already spent, with its start and end."
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
          >
            <Plus size={14} /> Log time
          </button>
        </div>
      </div>

      {running && <RunningTimer entry={running} onEdit={() => setDialog({ kind: 'edit', entry: running })} />}

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-2 mb-4">
        <select aria-label="Client" value={clientId} onChange={e => { setClientId(e.target.value); setProjectId('') }} className={smallSelect}>
          <option value="">All clients</option>
          {(options?.clients ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {clientId && projects.length > 0 && (
          <select aria-label="Project" value={projectId} onChange={e => setProjectId(e.target.value)} className={smallSelect}>
            <option value="">All projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        <select aria-label="Period" value={period} onChange={e => setPeriod(e.target.value as Period)} className={smallSelect}>
          {PERIODS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        {period === 'custom' && (
          <>
            <input type="date" aria-label="First day" value={from} onChange={e => setFrom(e.target.value)} className={smallSelect} />
            <span className="self-center text-sm text-gray-400">to</span>
            <input type="date" aria-label="Last day" value={to} onChange={e => setTo(e.target.value)} className={smallSelect} />
          </>
        )}
        <select aria-label="Billed" value={billed} onChange={e => setBilled(e.target.value as BilledFilter)} className={smallSelect}>
          <option value="all">Billed or not</option>
          <option value="unbilled">Not billed</option>
          <option value="billed">Billed</option>
        </select>
        {isTeamAdmin && options?.people && (
          <select aria-label="Person" value={person} onChange={e => setPerson(e.target.value)} className={smallSelect}
            data-tip="As an owner or admin you can see your teammates’ time too.">
            <option value="me">My time</option>
            <option value="all">Everyone’s time</option>
            {options.people.filter(p => p.userId !== options.me).map(p => (
              <option key={p.userId} value={p.userId}>{p.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Totals */}
      <div className="flex flex-wrap gap-x-8 gap-y-2 mb-4 text-sm">
        <div>
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide block">Total</span>
          <span className="font-medium text-gray-900 tabular-nums">{formatDuration(totals.totalMinutes)} <span className="text-gray-400 font-normal">({formatHours(totals.totalMinutes)} h)</span></span>
        </div>
        <div>
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide block">Not billed</span>
          <span className="font-medium text-gray-900 tabular-nums">{formatDuration(totals.unbilledMinutes)} <span className="text-gray-400 font-normal">({formatHours(totals.unbilledMinutes)} h)</span></span>
        </div>
        <div>
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide block">Entries</span>
          <span className="font-medium text-gray-900 tabular-nums">{entries.length}</span>
        </div>
      </div>

      {visibleSelected.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
          <span className="text-gray-700">{visibleSelected.length} selected</span>
          <button
            onClick={() => setBilledFor.mutate({ ids: visibleSelected.map(e => e.id), value: true })}
            disabled={setBilledFor.isPending}
            className="px-3 py-1 border border-gray-300 bg-white rounded-md hover:bg-gray-50"
          >
            Mark billed
          </button>
          <button
            onClick={() => setBilledFor.mutate({ ids: visibleSelected.map(e => e.id), value: false })}
            disabled={setBilledFor.isPending}
            className="px-3 py-1 border border-gray-300 bg-white rounded-md hover:bg-gray-50"
          >
            Mark not billed
          </button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-gray-500 hover:text-gray-800">Clear</button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : isError ? (
        <p className="text-sm text-red-500">Could not load your time.</p>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-white p-10 text-center">
          <Clock size={28} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">No time logged for these filters.</p>
          <button onClick={() => setDialog({ kind: 'log', clientId: clientId || null })} className="mt-2 text-sm text-blue-600 hover:underline">
            Log time →
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="pl-4 pr-1 py-3 w-8">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(editable.map(e => e.id)))}
                    className="h-4 w-4 accent-blue-600 align-middle"
                  />
                </th>
                <th className="px-3 py-3 text-left font-medium">Date</th>
                <th className="px-3 py-3 text-left font-medium">Client · task</th>
                <th className="hidden md:table-cell px-3 py-3 text-left font-medium">Type</th>
                <th className="hidden sm:table-cell px-3 py-3 text-left font-medium whitespace-nowrap">Start – end</th>
                <th className="px-3 py-3 text-right font-medium">
                  <Term tip="Hours and minutes (h:mm)">Duration</Term>
                </th>
                <th className="px-3 py-3 text-center font-medium">
                  <Term tip="Ticked once the time has been on an invoice, so it isn’t billed twice. Click to change.">Billed</Term>
                </th>
                <th className="px-3 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map(e => {
                const minutes = durationMinutes(e.startedAt, e.endedAt!)
                const nextDay = splitLocal(new Date(e.endedAt!)).date !== splitLocal(new Date(e.startedAt)).date
                return (
                  <tr key={e.id} className="hover:bg-gray-50 align-top">
                    <td className="pl-4 pr-1 py-3">
                      <input
                        type="checkbox"
                        aria-label="Select entry"
                        checked={selected.has(e.id)}
                        disabled={!e.canEdit}
                        onChange={() => toggle(e.id)}
                        className="h-4 w-4 accent-blue-600 align-middle"
                      />
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-gray-700">
                      {fmtDate(e.startedAt)}
                      {showPerson && <div className="text-xs text-gray-400">{e.userName}</div>}
                    </td>
                    <td className="px-3 py-3 min-w-56">
                      <div className="font-medium text-gray-900">
                        {e.clientName}{e.projectName && <span className="font-normal text-gray-500"> · {e.projectName}</span>}
                      </div>
                      <div className="text-gray-600 whitespace-pre-wrap break-words">{e.task}</div>
                      <div className="md:hidden text-xs text-gray-400 mt-0.5">{activityLabel(e.activity)}</div>
                    </td>
                    <td className="hidden md:table-cell px-3 py-3 text-gray-700 whitespace-nowrap">{activityLabel(e.activity)}</td>
                    <td className="hidden sm:table-cell px-3 py-3 text-gray-700 whitespace-nowrap tabular-nums">
                      {fmtTime(e.startedAt)} – {fmtTime(e.endedAt!)}{nextDay && <span className="text-xs text-gray-400"> (+1 day)</span>}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-gray-900">{formatDuration(minutes)}</td>
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        aria-label={e.billed ? 'Billed' : 'Not billed'}
                        checked={e.billed}
                        disabled={!e.canEdit || setBilledFor.isPending}
                        onChange={() => setBilledFor.mutate({ ids: [e.id], value: !e.billed })}
                        data-tip={e.billed && e.billedAt ? `Marked billed ${new Date(e.billedAt).toLocaleDateString()}` : undefined}
                        className="h-4 w-4 accent-blue-600 align-middle"
                      />
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-right">
                      {e.canEdit && (
                        <>
                          <button onClick={() => setDialog({ kind: 'edit', entry: e })} aria-label="Edit entry" data-tip="Edit this entry"
                            className="p-1 text-gray-400 hover:text-gray-700"><Pencil size={14} /></button>
                          <button
                            onClick={() => { if (window.confirm('Delete this time entry? This can’t be undone.')) remove.mutate(e.id) }}
                            aria-label="Delete entry" data-tip="Delete this entry"
                            className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {data?.truncated && (
            <p className="px-4 py-3 text-xs text-amber-700 border-t border-gray-100">
              Only the most recent entries are shown. Narrow the period or pick a client to see the rest.
            </p>
          )}
        </div>
      )}

      {dialog && <TimeEntryDialog mode={dialog} onClose={() => setDialog(null)} />}
      {reportOpen && (
        <TimeReportDialog
          isTeamAdmin={isTeamAdmin}
          initial={{ clientId, projectId, period, from: range?.from ?? thisMonth.from, to: range?.to ?? thisMonth.to }}
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  )
}
