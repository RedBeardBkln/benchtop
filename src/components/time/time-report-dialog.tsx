'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { PERIODS, localDayEnd, localDayStart, periodRange, type BilledFilter, type Period } from '@/lib/time-tracking'
import { fieldCls, labelCls, useTimeOptions } from './use-time'

// Chooses what goes on a client's time report, then opens it at /time/report. The report page reads
// the same filters the time list uses, plus a few layout choices.

export function TimeReportDialog({
  isTeamAdmin,
  initial,
  onClose,
}: {
  isTeamAdmin: boolean
  initial: { clientId: string; projectId: string; period: Period; from: string; to: string }
  onClose: () => void
}) {
  const router = useRouter()
  const { data: options } = useTimeOptions()
  const [clientId, setClientId] = useState(initial.clientId)
  const [projectId, setProjectId] = useState(initial.projectId)
  const [period, setPeriod] = useState<Period>(initial.period === 'all' ? 'this-month' : initial.period)
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [billed, setBilled] = useState<BilledFilter>('unbilled')
  const [everyone, setEveryone] = useState(isTeamAdmin)
  const [showTimes, setShowTimes] = useState(true)

  const projects = (options?.projects ?? []).filter(p => p.clientId === clientId)
  const range = period === 'custom' ? (from && to ? { from, to } : null) : periodRange(period)

  let problem: string | null = null
  if (!clientId) problem = 'Choose a client.'
  else if (period === 'custom' && !range) problem = 'Enter both dates.'
  else if (range && range.from > range.to) problem = 'The first day must be before the last.'

  function open() {
    const qs = new URLSearchParams({ client: clientId, billed, user: everyone ? 'all' : 'me' })
    if (projectId) qs.set('project', projectId)
    if (range) {
      qs.set('from', localDayStart(range.from)!.toISOString())
      qs.set('to', localDayEnd(range.to)!.toISOString())
      // Shown in the heading as chosen, whatever the reader's time zone
      qs.set('first', range.from)
      qs.set('last', range.to)
    }
    if (!showTimes) qs.set('times', '0')
    router.push(`/time/report?${qs}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onKeyDown={e => e.key === 'Escape' && onClose()}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">Prepare a time report</h3>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <form className="px-5 py-4 space-y-4" onSubmit={e => { e.preventDefault(); if (!problem) open() }}>
          <p className="text-sm text-gray-500">
            A report for one client that you can save as a PDF or download as a spreadsheet. It lists each task with its date, type and time, and the totals.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="tr-client" className={labelCls}>Client <span className="text-red-400">*</span></label>
              <select id="tr-client" value={clientId} onChange={e => { setClientId(e.target.value); setProjectId('') }} className={fieldCls}>
                <option value="">Choose a client</option>
                {(options?.clients ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="tr-project" className={labelCls}>Project</label>
              <select id="tr-project" value={projectId} disabled={!clientId} onChange={e => setProjectId(e.target.value)} className={fieldCls}>
                <option value="">All of the client’s work</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="tr-period" className={labelCls}>Period</label>
            <select id="tr-period" value={period} onChange={e => setPeriod(e.target.value as Period)} className={fieldCls}>
              {PERIODS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
            {period === 'custom' && (
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <label htmlFor="tr-from" className={labelCls}>First day</label>
                  <input id="tr-from" type="date" value={from} onChange={e => setFrom(e.target.value)} className={fieldCls} />
                </div>
                <div>
                  <label htmlFor="tr-to" className={labelCls}>Last day</label>
                  <input id="tr-to" type="date" value={to} onChange={e => setTo(e.target.value)} className={fieldCls} />
                </div>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="tr-billed" className={labelCls}>Include</label>
            <select id="tr-billed" value={billed} onChange={e => setBilled(e.target.value as BilledFilter)} className={fieldCls}>
              <option value="unbilled">Time not yet billed</option>
              <option value="all">All time, billed or not</option>
              <option value="billed">Only time already billed</option>
            </select>
          </div>

          <div className="space-y-2">
            {isTeamAdmin && (
              <label className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer w-fit"
                data-tip="Includes time your teammates logged for this client, with a Person column. Untick for just your own time.">
                <input type="checkbox" checked={everyone} onChange={e => setEveryone(e.target.checked)} className="h-4 w-4 accent-blue-600" />
                Include the whole team’s time
              </label>
            )}
            <label className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer w-fit"
              data-tip="Shows the start and end time of each entry as well as its duration.">
              <input type="checkbox" checked={showTimes} onChange={e => setShowTimes(e.target.checked)} className="h-4 w-4 accent-blue-600" />
              Show start and end times
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            {problem && clientId && <p className="mr-auto text-xs text-gray-500">{problem}</p>}
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!!problem}
              data-tip={problem ?? undefined}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              Prepare report
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
