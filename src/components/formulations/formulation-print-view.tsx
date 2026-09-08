'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Printer, ArrowLeft } from 'lucide-react'
import type { FormulationDetail } from '@/lib/types'

type StepParams = {
  temp_c?: string
  time_min?: string
  ph?: string
  solids_pct?: string
  shear?: string
  pressure?: string
}

const PARAM_LABELS: Array<[keyof StepParams, string]> = [
  ['temp_c', 'Temp (°C)'],
  ['time_min', 'Time (min)'],
  ['ph', 'pH'],
  ['solids_pct', 'Solids (%)'],
  ['shear', 'Shear'],
  ['pressure', 'Pressure'],
]

export function FormulationPrintView({ id }: { id: string }) {
  const { data, isLoading, error } = useQuery<FormulationDetail>({
    queryKey: ['formulation', id],
    queryFn: () =>
      fetch(`/api/formulations/${id}`).then(r => {
        if (!r.ok) throw new Error('Not found')
        return r.json()
      }),
  })

  if (isLoading) return <div className="px-8 py-8 text-sm text-gray-400">Loading…</div>
  if (error || !data) {
    return (
      <div className="px-8 py-8">
        <p className="text-sm text-red-500">Formulation not found.</p>
      </div>
    )
  }

  const isLocked = data.status === 'locked'
  const sortedLines = [...data.lines].sort((a, b) => a.position - b.position)
  const totalWeightG = sortedLines.reduce((s, l) => s + parseFloat(l.weightG), 0)
  const servingSizeG = data.servingSizeG ? parseFloat(data.servingSizeG) : undefined
  const yieldPct = data.yieldPct ? parseFloat(data.yieldPct) : 100
  const notes = data.notes?.trim() ?? ''
  const sortedSteps = [...data.processSteps].sort((a, b) => a.stepNo - b.stepNo)

  return (
    <div className="print-page min-h-screen bg-white">
      {/* On-screen only controls */}
      <div className="print:hidden flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-gray-50 sticky top-0">
        <Link
          href={`/formulations/${id}`}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft size={14} /> Back to formulation
        </Link>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white text-sm
                     rounded-md hover:bg-blue-700 transition-colors"
        >
          <Printer size={13} /> Print
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-8 py-8 print:px-0 print:py-0 print:max-w-none">
        {/* Header */}
        <div className="mb-6 pb-4 border-b-2 border-gray-800">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold text-gray-900">{data.name}</h1>
            <span className="text-base text-gray-500">v{data.version}</span>
            <span className="px-2 py-0.5 text-xs font-medium rounded border border-gray-400 text-gray-700">
              {isLocked ? 'Locked' : 'Draft'}
            </span>
          </div>
          <div className="mt-1 text-sm text-gray-600">
            <span className="capitalize">{data.mode === 'ground_up' ? 'Ground up' : 'Reverse'}</span>
            {data.project?.name && <span> · {data.project.name}</span>}
          </div>
        </div>

        {/* Metadata row */}
        <div className="flex flex-wrap gap-x-8 gap-y-2 mb-6 text-sm">
          <div>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide block">Batch weight</span>
            <span className="font-medium text-gray-900">
              {totalWeightG > 0 ? `${totalWeightG.toFixed(1)} g` : '—'}
            </span>
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide block">Serving size</span>
            <span className="font-medium text-gray-900">
              {servingSizeG ? `${servingSizeG.toFixed(1)} g` : '—'}
            </span>
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide block">Yield</span>
            <span className="font-medium text-gray-900">{yieldPct.toFixed(1)}%</span>
          </div>
        </div>

        {/* Ingredient table */}
        <table className="w-full text-sm border-collapse mb-6">
          <thead>
            <tr className="border-b-2 border-gray-800 text-xs text-gray-600 uppercase tracking-wide">
              <th className="text-left font-medium py-2 pr-2">Ingredient</th>
              <th className="text-right font-medium py-2 px-2 w-28">Weight (g)</th>
              <th className="text-right font-medium py-2 pl-2 w-20">%</th>
            </tr>
          </thead>
          <tbody>
            {sortedLines.map(line => {
              const weightG = parseFloat(line.weightG)
              const pct = totalWeightG > 0 ? (weightG / totalWeightG) * 100 : 0
              return (
                <tr key={line.id} className="border-b border-gray-200">
                  <td className="py-1.5 pr-2 text-gray-900">{line.ingredientName}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums text-gray-800">{weightG.toFixed(1)}</td>
                  <td className="py-1.5 pl-2 text-right tabular-nums text-gray-800">{pct.toFixed(1)}%</td>
                </tr>
              )
            })}
            <tr className="border-t-2 border-gray-800 font-medium text-gray-900">
              <td className="py-2 pr-2">Total ({sortedLines.length} ingredient{sortedLines.length !== 1 ? 's' : ''})</td>
              <td className="py-2 px-2 text-right tabular-nums">{totalWeightG.toFixed(1)}</td>
              <td className="py-2 pl-2 text-right tabular-nums">
                {totalWeightG > 0 ? '100.0%' : '—'}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Notes */}
        {notes && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-2 pb-1 border-b border-gray-300">Notes</h2>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{notes}</p>
          </div>
        )}

        {/* Process steps */}
        {sortedSteps.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-2 pb-1 border-b border-gray-300">Process steps</h2>
            <ol className="space-y-3">
              {sortedSteps.map((step, i) => {
                const p = (step.params ?? {}) as StepParams
                const populatedParams = PARAM_LABELS.filter(([key]) => p[key])
                return (
                  <li key={step.id} className="text-sm text-gray-800 print:break-inside-avoid">
                    <div className="flex gap-2">
                      <span className="font-medium text-gray-500 tabular-nums">{i + 1}.</span>
                      <div className="flex-1">
                        <p>{step.instruction}</p>
                        {(populatedParams.length > 0 || step.lossPct != null) && (
                          <p className="mt-0.5 text-xs text-gray-500">
                            {populatedParams.map(([key, label]) => `${label}: ${p[key]}`).join(' · ')}
                            {populatedParams.length > 0 && step.lossPct != null && ' · '}
                            {step.lossPct != null && `Yield loss (%): ${parseFloat(step.lossPct).toFixed(1)}`}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-3 border-t border-gray-200 text-xs text-gray-400">
          Printed {new Date().toLocaleString()} · Formulation ID: {data.id}
        </div>
      </div>
    </div>
  )
}
