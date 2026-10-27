'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { readErrorMessage } from '@/lib/utils'
import {
  TIME_ACTIVITIES, checkEntryTimes, combineLocal, durationMinutes, endFromClock, formatDuration, parseDuration,
  splitLocal, type TimeActivity,
} from '@/lib/time-tracking'
import { fieldCls, labelCls, useTimeOptions, type TimeEntryRow } from './use-time'

// Logs time by hand, starts a timer, or edits an entry. Times are entered in the browser's time zone:
// a date, a start and an end time (an end before the start runs into the next day), with the duration
// worked out, or typed to set the end.

export type EntryDialogMode =
  | { kind: 'log'; clientId?: string | null }
  | { kind: 'timer'; clientId?: string | null }
  | { kind: 'edit'; entry: TimeEntryRow }

export function TimeEntryDialog({ mode, onClose }: { mode: EntryDialogMode; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { data: options, isLoading } = useTimeOptions()
  const entry = mode.kind === 'edit' ? mode.entry : null
  const running = !!entry && !entry.endedAt
  const showTimes = mode.kind !== 'timer'

  const start0 = entry ? splitLocal(new Date(entry.startedAt)) : { date: splitLocal(new Date()).date, time: '' }
  const end0 = entry?.endedAt ? splitLocal(new Date(entry.endedAt)).time : ''
  const [clientId, setClientId] = useState(entry?.clientId ?? (mode.kind !== 'edit' ? mode.clientId : null) ?? '')
  const [projectId, setProjectId] = useState(entry?.projectId ?? '')
  const [activity, setActivity] = useState<TimeActivity | ''>((entry?.activity as TimeActivity) ?? '')
  const [task, setTask] = useState(entry?.task ?? '')
  const [date, setDate] = useState(start0.date)
  const [startTime, setStartTime] = useState(start0.time)
  const [endTime, setEndTime] = useState(end0)
  const [durationText, setDurationText] = useState(
    entry?.endedAt ? formatDuration(durationMinutes(entry.startedAt, entry.endedAt)) : '',
  )
  const [billed, setBilled] = useState(entry?.billed ?? false)

  // The entry's own client and project stay choosable even if since archived
  const clients = [...(options?.clients ?? [])]
  if (entry && !clients.some(c => c.id === entry.clientId)) clients.unshift({ id: entry.clientId, name: entry.clientName })
  const projects = (options?.projects ?? []).filter(p => p.clientId === clientId)
  if (entry?.projectId && entry.clientId === clientId && !projects.some(p => p.id === entry.projectId)) {
    projects.unshift({ id: entry.projectId, name: entry.projectName ?? 'Project', clientId })
  }

  const start = combineLocal(date, startTime)
  const end = start && endTime ? endFromClock(start, endTime) : null
  const nextDay = !!(start && end && splitLocal(end).date !== date)

  function onEndTime(v: string) {
    setEndTime(v)
    const e = start && v ? endFromClock(start, v) : null
    setDurationText(start && e ? formatDuration(durationMinutes(start, e)) : '')
  }
  function onStartTime(v: string) {
    setStartTime(v)
    const s = combineLocal(date, v)
    const e = s && endTime ? endFromClock(s, endTime) : null
    if (s && e) setDurationText(formatDuration(durationMinutes(s, e)))
  }
  // Typing a duration moves the end time
  function onDuration(v: string) {
    setDurationText(v)
    const min = parseDuration(v)
    if (start && min != null && min > 0) setEndTime(splitLocal(new Date(start.getTime() + min * 60_000)).time)
  }

  let problem: string | null = null
  if (!clientId) problem = 'Choose a client.'
  else if (!activity) problem = 'Choose the type of work.'
  else if (!task.trim()) problem = 'Describe the task.'
  else if (showTimes && !start) problem = 'Enter the date and start time.'
  else if (showTimes && !running && !end) problem = 'Enter the end time or the duration.'
  else if (showTimes && endTime && !end) problem = 'Enter a valid end time.'
  else if (showTimes && start && end) problem = checkEntryTimes(start, end)

  const save = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { clientId, projectId: projectId || null, activity, task: task.trim() }
      if (mode.kind === 'timer') {
        body.startedAt = new Date().toISOString()
        body.endedAt = null
      } else {
        body.startedAt = start!.toISOString()
        // A running timer stays running unless an end is given, which stops it
        if (end) {
          body.endedAt = end.toISOString()
          body.billed = billed
        }
      }
      const r = await fetch(entry ? `/api/time-entries/${entry.id}` : '/api/time-entries', {
        method: entry ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not save the time entry'))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] })
      toast.success(mode.kind === 'timer' ? 'Timer started' : entry ? 'Time entry saved' : 'Time logged')
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const title = mode.kind === 'timer' ? 'Start a timer' : entry ? (running ? 'Edit running timer' : 'Edit time entry') : 'Log time'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onKeyDown={e => e.key === 'Escape' && onClose()}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <form
          className="px-5 py-4 space-y-4"
          onSubmit={e => { e.preventDefault(); if (!problem) save.mutate() }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="te-client" className={labelCls}>Client <span className="text-red-400">*</span></label>
              <select
                id="te-client"
                autoFocus
                value={clientId}
                disabled={isLoading}
                onChange={e => { setClientId(e.target.value); setProjectId('') }}
                className={fieldCls}
              >
                <option value="">{isLoading ? 'Loading clients…' : 'Choose a client'}</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="te-project" className={labelCls}>Project <span className="text-gray-400 font-normal">(optional)</span></label>
              <select
                id="te-project"
                value={projectId}
                disabled={!clientId || projects.length === 0}
                onChange={e => setProjectId(e.target.value)}
                data-tip="Only this client’s active projects are listed. Leave it empty for general work for the client."
                className={fieldCls}
              >
                <option value="">{clientId && projects.length === 0 ? 'No projects for this client' : 'No project'}</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          {!isLoading && options && options.clients.length === 0 && !entry && (
            <p className="text-xs text-amber-700">
              You don’t have any clients to log time against yet.{' '}
              {options.people ? 'Add one under Clients first.' : 'Ask an account admin to give you access to a client’s projects.'}
            </p>
          )}

          <div>
            <label htmlFor="te-activity" className={labelCls}>Type <span className="text-red-400">*</span></label>
            <select id="te-activity" value={activity} onChange={e => setActivity(e.target.value as TimeActivity)} className={fieldCls}>
              <option value="">Choose the type of work</option>
              {TIME_ACTIVITIES.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="te-task" className={labelCls}>Task <span className="text-red-400">*</span></label>
            <textarea
              id="te-task"
              rows={3}
              value={task}
              onChange={e => setTask(e.target.value)}
              placeholder="e.g. Reformulated the bar to hit 20 g protein; call with Jamie about sweetener options"
              className={fieldCls}
            />
            <p className="mt-1 text-xs text-gray-400">This appears on time reports you send the client.</p>
          </div>

          {showTimes && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label htmlFor="te-date" className={labelCls}>Date <span className="text-red-400">*</span></label>
                <input id="te-date" type="date" value={date} onChange={e => setDate(e.target.value)} className={fieldCls} />
              </div>
              <div>
                <label htmlFor="te-start" className={labelCls}>Start <span className="text-red-400">*</span></label>
                <input id="te-start" type="time" value={startTime} onChange={e => onStartTime(e.target.value)} className={fieldCls} />
              </div>
              <div>
                <label htmlFor="te-end" className={labelCls}>End {!running && <span className="text-red-400">*</span>}</label>
                <input id="te-end" type="time" value={endTime} onChange={e => onEndTime(e.target.value)} className={fieldCls} />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label htmlFor="te-duration" className={labelCls}>Duration</label>
                <input
                  id="te-duration"
                  value={durationText}
                  onChange={e => onDuration(e.target.value)}
                  onBlur={() => { const m = parseDuration(durationText); if (m != null && m > 0) setDurationText(formatDuration(m)) }}
                  placeholder="h:mm"
                  inputMode="decimal"
                  data-tip="Worked out from the start and end. Or type it (1:30, 1.5 or 90m) and the end time follows."
                  className={fieldCls}
                />
              </div>
            </div>
          )}
          {nextDay && <p className="-mt-2 text-xs text-gray-500">Ends the next day.</p>}
          {running && <p className="-mt-2 text-xs text-gray-500">This timer is still running. Leave the end empty to keep it running, or enter one to stop it.</p>}
          {mode.kind === 'timer' && <p className="text-xs text-gray-500">The timer starts now. Stop it from the Time page when you’re done.</p>}

          {showTimes && (!running || end) && (
            <label className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer w-fit"
              data-tip="Tick this for time that has already been on an invoice, so it isn’t billed twice.">
              <input type="checkbox" checked={billed} onChange={e => setBilled(e.target.checked)} className="h-4 w-4 accent-blue-600" />
              Already billed
            </label>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            {problem && (clientId || task || endTime) && <p className="mr-auto text-xs text-gray-500">{problem}</p>}
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!!problem || save.isPending}
              data-tip={problem ?? undefined}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {save.isPending ? 'Saving…' : mode.kind === 'timer' ? 'Start timer' : running && end ? 'Stop and save' : entry ? 'Save' : 'Log time'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
