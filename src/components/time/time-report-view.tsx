'use client'

import { useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, CheckCheck, Download, Printer } from 'lucide-react'
import { readErrorMessage } from '@/lib/utils'
import type { ClientAddress } from '@/lib/client-schemas'
import { timeReportFileName } from '@/lib/download-name'
import {
  activityLabel, combineLocal, durationMinutes, formatDuration, formatHours, splitLocal, summarizeEntries, timeEntriesCsv,
} from '@/lib/time-tracking'
import { CompanyLogo } from '@/components/company-logo'
import type { TimeEntryRow } from './use-time'

// The client-facing time report: who it's from, who it's for, each task with its date, type and time,
// and the totals. Print it or save it as a PDF from the browser; the CSV has the same rows.
// Billed status is for you, not the client, so it isn't printed.

type ReportData = {
  client: { id: string; name: string; legalName: string | null; billingAddress: ClientAddress | null; billingEmail: string | null }
  from: { company: string; name: string | null; email: string | null; phone: string | null }
  entries: TimeEntryRow[]
  truncated: boolean
}

const fmtDay = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

function addressLines(a: ClientAddress | null): string[] {
  if (!a) return []
  const cityLine = [a.city, [a.region, a.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  return [a.line1, a.line2, cityLine, a.country].map(s => s?.trim()).filter((s): s is string => !!s)
}

export function TimeReportView() {
  const queryClient = useQueryClient()
  const search = useSearchParams()
  const qs = search.toString()
  const first = search.get('first')
  const last = search.get('last')
  const showTimes = search.get('times') !== '0'
  const showPerson = search.get('user') === 'all'

  const { data, isLoading, error } = useQuery<ReportData>({
    queryKey: ['time-report', qs],
    queryFn: async () => {
      const r = await fetch(`/api/time-entries/report?${qs}`)
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not load the report'))
      return r.json()
    },
  })

  const rows = useMemo(
    () => [...(data?.entries ?? [])].sort((a, b) => a.startedAt.localeCompare(b.startedAt)),
    [data],
  )
  const totals = summarizeEntries(rows)
  // Only list a Person column when more than one person's time is on it
  const personColumn = showPerson && new Set(rows.map(r => r.userId)).size > 1
  const projectColumn = !search.get('project') && rows.some(r => r.projectName)
  const projectName = search.get('project') ? rows.find(r => r.projectName)?.projectName ?? null : null
  const unbilled = rows.filter(r => !r.billed && r.canEdit)

  // The browser proposes the tab title as the file name when saving as a PDF
  useEffect(() => {
    if (data) document.title = timeReportFileName({ clientName: data.client.name, from: first, to: last })
  }, [data, first, last])

  const markBilled = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/time-entries/billed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: unbilled.map(e => e.id), billed: true }),
      })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not mark the time billed'))
      return (await r.json()) as { updated: number }
    },
    onSuccess: ({ updated }) => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] })
      queryClient.invalidateQueries({ queryKey: ['time-report'] })
      toast.success(`${updated} ${updated === 1 ? 'entry' : 'entries'} marked billed`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function downloadCsv() {
    if (!data) return
    const csv = timeEntriesCsv(rows, { clientName: data.client.name, includePerson: personColumn })
    // BOM so Excel reads accented characters correctly
    const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${timeReportFileName({ clientName: data.client.name, from: first, to: last })}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) return <div className="px-8 py-8 text-sm text-gray-400">Loading…</div>
  if (error || !data) {
    return (
      <div className="px-8 py-8">
        <p className="text-sm text-red-500">{(error as Error | null)?.message ?? 'Could not load the report.'}</p>
        <Link href="/time" className="mt-2 inline-block text-sm text-blue-600 hover:underline">Back to Time</Link>
      </div>
    )
  }

  const firstDay = first ? combineLocal(first, '00:00') : null
  const lastDay = last ? combineLocal(last, '00:00') : null
  const period = firstDay && lastDay
    ? `${fmtDay(firstDay)} – ${fmtDay(lastDay)}`
    : rows.length > 0 ? `${fmtDay(new Date(rows[0].startedAt))} – ${fmtDay(new Date(rows[rows.length - 1].startedAt))}` : 'All time'
  const billTo = data.client.legalName?.trim() || data.client.name
  const address = addressLines(data.client.billingAddress)
  const contact = [data.from.email, data.from.phone].filter(Boolean).join(' · ')

  return (
    <div className="print-page min-h-screen bg-white">
      {/* On-screen only controls */}
      <div className="print:hidden flex flex-wrap items-center gap-2 px-6 py-3 border-b border-gray-100 bg-gray-50 sticky top-0">
        <Link href="/time" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mr-auto">
          <ArrowLeft size={14} /> Back to Time
        </Link>
        {unbilled.length > 0 && (
          <button
            onClick={() => markBilled.mutate()}
            disabled={markBilled.isPending}
            data-tip="Once you’ve sent this report or invoiced the time, mark it billed so it isn’t billed again."
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 bg-white rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            <CheckCheck size={13} /> Mark {unbilled.length} {unbilled.length === 1 ? 'entry' : 'entries'} billed
          </button>
        )}
        <button
          onClick={downloadCsv}
          disabled={rows.length === 0}
          data-tip="Downloads these entries as a spreadsheet (CSV) that opens in Excel, Numbers or Google Sheets."
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 bg-white rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          <Download size={13} /> Download CSV
        </button>
        <button
          onClick={() => window.print()}
          data-tip="Opens the print dialog. Choose “Save as PDF” as the printer to get a PDF to send."
          className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
        >
          <Printer size={13} /> Print or save PDF
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-8 print:px-0 print:py-0 print:max-w-none">
        {data.truncated && (
          <p className="print:hidden mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            This report has too many entries to show them all. Choose a shorter period.
          </p>
        )}

        {/* Header */}
        <div className="flex flex-wrap justify-between gap-6 pb-4 mb-6 border-b-2 border-gray-800">
          <div>
            <CompanyLogo className="max-h-16 max-w-[220px] mb-2" />
            <div className="text-lg font-semibold text-gray-900">{data.from.company}</div>
            {data.from.name && <div className="text-sm text-gray-700">{data.from.name}</div>}
            {contact && <div className="text-sm text-gray-600">{contact}</div>}
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-semibold text-gray-900">Time report</h1>
            <div className="text-sm text-gray-700">{period}</div>
            <div className="text-xs text-gray-500 mt-0.5">Prepared {fmtDay(new Date())}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-12 gap-y-4 mb-6 text-sm">
          <div>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide block">Prepared for</span>
            <div className="font-medium text-gray-900">{billTo}</div>
            {billTo !== data.client.name && <div className="text-gray-700">{data.client.name}</div>}
            {address.map(l => <div key={l} className="text-gray-700">{l}</div>)}
          </div>
          {projectName && (
            <div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide block">Project</span>
              <div className="font-medium text-gray-900">{projectName}</div>
            </div>
          )}
          <div>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide block">Total time</span>
            <div className="font-medium text-gray-900 tabular-nums">
              {formatHours(totals.totalMinutes)} hours <span className="text-gray-500 font-normal">({formatDuration(totals.totalMinutes)})</span>
            </div>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-gray-500">No time matches this report’s choices.</p>
        ) : (
          <>
            <table className="w-full text-sm border-collapse mb-6">
              <thead>
                <tr className="border-b-2 border-gray-800 text-xs text-gray-600 uppercase tracking-wide">
                  <th className="text-left font-medium py-2 pr-2 whitespace-nowrap">Date</th>
                  {personColumn && <th className="text-left font-medium py-2 px-2">Person</th>}
                  {projectColumn && <th className="text-left font-medium py-2 px-2">Project</th>}
                  <th className="text-left font-medium py-2 px-2">Type</th>
                  <th className="text-left font-medium py-2 px-2">Task</th>
                  {showTimes && <th className="text-left font-medium py-2 px-2 whitespace-nowrap">Time</th>}
                  <th className="text-right font-medium py-2 pl-2">Hours</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(e => {
                  const min = durationMinutes(e.startedAt, e.endedAt!)
                  const nextDay = splitLocal(new Date(e.endedAt!)).date !== splitLocal(new Date(e.startedAt)).date
                  return (
                    <tr key={e.id} className="border-b border-gray-200 align-top">
                      <td className="py-1.5 pr-2 text-gray-800 whitespace-nowrap">{fmtDay(new Date(e.startedAt))}</td>
                      {personColumn && <td className="py-1.5 px-2 text-gray-800">{e.userName}</td>}
                      {projectColumn && <td className="py-1.5 px-2 text-gray-800">{e.projectName ?? '—'}</td>}
                      <td className="py-1.5 px-2 text-gray-800 whitespace-nowrap">{activityLabel(e.activity)}</td>
                      <td className="py-1.5 px-2 text-gray-900 whitespace-pre-wrap break-words">{e.task}</td>
                      {showTimes && (
                        <td className="py-1.5 px-2 text-gray-800 whitespace-nowrap tabular-nums">
                          {fmtTime(e.startedAt)} – {fmtTime(e.endedAt!)}{nextDay && ' (+1 day)'}
                        </td>
                      )}
                      <td className="py-1.5 pl-2 text-right text-gray-900 tabular-nums whitespace-nowrap">{formatHours(min)}</td>
                    </tr>
                  )
                })}
                <tr className="border-t-2 border-gray-800 font-medium text-gray-900">
                  <td className="py-2 pr-2" colSpan={2 + (personColumn ? 1 : 0) + (projectColumn ? 1 : 0) + 1 + (showTimes ? 1 : 0)}>
                    Total ({rows.length} {rows.length === 1 ? 'entry' : 'entries'})
                  </td>
                  <td className="py-2 pl-2 text-right tabular-nums">{formatHours(totals.totalMinutes)}</td>
                </tr>
              </tbody>
            </table>

            {totals.byActivity.length > 1 && (
              <div className="max-w-sm print:break-inside-avoid">
                <h2 className="text-sm font-semibold text-gray-900 mb-2 pb-1 border-b border-gray-300">Summary by type</h2>
                <table className="w-full text-sm">
                  <tbody>
                    {totals.byActivity.map(a => (
                      <tr key={a.key} className="border-b border-gray-100">
                        <td className="py-1 pr-2 text-gray-800">{a.label}</td>
                        <td className="py-1 pl-2 text-right tabular-nums text-gray-900">{formatHours(a.minutes)} h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-6 text-xs text-gray-500">Hours are decimal: 1.50 hours is 1 hour 30 minutes.</p>
          </>
        )}
      </div>
    </div>
  )
}
