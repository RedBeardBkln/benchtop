'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Printer, ArrowLeft } from 'lucide-react'
import type { FormulationDetail, Nutrient, ProjectTarget } from '@/lib/types'
import { calcNutrientProfile, formatAmt } from '@/lib/formulation-calc'
import { computeProcessYield, describeStepLoss, toLossStep } from '@/lib/process-loss'
import { stepMeasurementBoxes, type StepParams } from '@/lib/step-measurements'
import { formatWeightG } from '@/lib/weight'
import { CATEGORY_ORDER, evaluateTargets, fmtRequirement, type ValidationStatus } from '@/lib/target-validation'
import type { PrintSection } from '@/lib/print-sections'

// Literal class names so Tailwind includes them
const COL_SPAN: Record<number, string> = {
  2: 'col-span-2', 3: 'col-span-3', 4: 'col-span-4', 7: 'col-span-7', 12: 'col-span-12',
}

// Plain-text status so it survives printing without background graphics
const STATUS_LABEL: Record<ValidationStatus, string> = {
  pass: 'Pass',
  warn: 'Warn',
  fail: 'Fail',
  'no-data': '—',
}

const SECTION_HEADING = 'text-sm font-semibold text-gray-900 mb-2 pb-1 border-b border-gray-300 print:break-after-avoid'

export function FormulationPrintView({ id, sections }: { id: string; sections: PrintSection[] }) {
  const showFormulation = sections.includes('formulation')
  const showProcess = sections.includes('process')
  const showNutrients = sections.includes('nutrients')
  const showValidation = sections.includes('validation')
  const needsNutrients = showNutrients || showValidation

  const { data, isLoading, error } = useQuery<FormulationDetail>({
    queryKey: ['formulation', id],
    queryFn: () =>
      fetch(`/api/formulations/${id}`).then(r => {
        if (!r.ok) throw new Error('Not found')
        return r.json()
      }),
  })

  const { data: allNutrients, isLoading: nutrientsLoading, error: nutrientsError } = useQuery<Nutrient[]>({
    queryKey: ['nutrients-all'],
    queryFn: () =>
      fetch('/api/nutrients').then(r => {
        if (!r.ok) throw new Error('Could not load nutrients')
        return r.json()
      }),
    staleTime: Infinity,
    enabled: needsNutrients,
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
  const notes = data.notes?.trim() ?? ''
  const sortedSteps = [...data.processSteps].sort((a, b) => a.stepNo - b.stepNo)
  const lossSteps = sortedSteps.map(toLossStep)
  const processYield = computeProcessYield(totalWeightG, lossSteps)

  // Same inputs as the editor's calcResult, built from the saved formulation
  const calcResult = needsNutrients && allNutrients && sortedLines.length > 0
    ? calcNutrientProfile({
        lines: sortedLines.map(l => ({
          ingredientId: l.ingredientId,
          weightG: parseFloat(l.weightG),
          nutrients: l.nutrients.map(n => ({
            nutrientId: n.nutrientId,
            amountPer100g: parseFloat(n.amountPer100g),
          })),
        })),
        allNutrients: allNutrients.map(n => ({
          id: n.id,
          name: n.name,
          unit: n.unit,
          category: n.category,
          dailyValueAmount: n.dailyValueAmount != null ? parseFloat(n.dailyValueAmount) : null,
        })),
        servingSizeG,
        steps: lossSteps,
      })
    : null
  const projectTargets = (data.project?.targets ?? []) as ProjectTarget[]
  const validations = calcResult ? evaluateTargets(projectTargets, calcResult.results, servingSizeG) : []
  const showPerServing = !!servingSizeG && servingSizeG > 0

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
          {data.iterationNote?.trim() && (
            <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{data.iterationNote.trim()}</p>
          )}
        </div>

        {/* Metadata row */}
        <div className="flex flex-wrap gap-x-8 gap-y-2 mb-6 text-sm">
          <div>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide block">Batch weight</span>
            <span className="font-medium text-gray-900">
              {totalWeightG > 0 ? `${formatWeightG(totalWeightG)} g` : '—'}
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
            <span className="font-medium text-gray-900">
              {totalWeightG > 0 ? `${processYield.yieldPct.toFixed(1)}% · ${processYield.finishedWeightG.toFixed(1)} g` : '—'}
            </span>
          </div>
        </div>

        {showFormulation && (
          <>
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
                    <td className="py-1.5 px-2 text-right tabular-nums text-gray-800">{formatWeightG(weightG)}</td>
                    <td className="py-1.5 pl-2 text-right tabular-nums text-gray-800">{pct.toFixed(1)}%</td>
                  </tr>
                )
              })}
              <tr className="border-t-2 border-gray-800 font-medium text-gray-900">
                <td className="py-2 pr-2">Total ({sortedLines.length} ingredient{sortedLines.length !== 1 ? 's' : ''})</td>
                <td className="py-2 px-2 text-right tabular-nums">{formatWeightG(totalWeightG)}</td>
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
          </>
        )}

        {/* Process steps */}
        {showProcess && sortedSteps.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-2 pb-1 border-b border-gray-300">Process steps</h2>
            <ol className="space-y-3">
              {sortedSteps.map((step, i) => {
                const p = (step.params ?? {}) as StepParams
                const boxes = stepMeasurementBoxes(p, step.equipmentName)
                const lossLabel = describeStepLoss(step)
                return (
                  <li key={step.id} className="text-sm text-gray-800 print:break-inside-avoid">
                    <div className="flex gap-2">
                      <span className="font-medium text-gray-500 tabular-nums">{i + 1}.</span>
                      <div className="flex-1">
                        <p>{step.instruction}</p>
                        {lossLabel && <p className="mt-0.5 text-xs text-gray-500">{lossLabel}</p>}
                        {/* Always printed; empty boxes are for writing in measurements at the bench */}
                        <div className="mt-1.5 grid grid-cols-12 gap-x-2 gap-y-1.5">
                          {boxes.map(box => (
                            <div key={box.label} className={COL_SPAN[box.span]}>
                              <div className="text-[10px] uppercase tracking-wide text-gray-500">{box.label}</div>
                              <div className={`border border-gray-400 rounded-sm px-1.5 py-1 text-xs text-gray-900 whitespace-pre-wrap ${
                                box.tall ? 'min-h-14' : 'min-h-7'
                              }`}>
                                {box.value}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        )}

        {/* Full nutrient profile */}
        {showNutrients && (
          <div className="mb-6">
            <h2 className={SECTION_HEADING}>Full nutrient profile</h2>
            {nutrientsLoading ? (
              <p className="text-sm text-gray-400">Loading…</p>
            ) : nutrientsError ? (
              <p className="text-sm text-gray-500">Could not load nutrient data.</p>
            ) : !calcResult || calcResult.results.length === 0 ? (
              <p className="text-sm text-gray-500">No nutrient data available.</p>
            ) : (
              <div className="space-y-4">
                {CATEGORY_ORDER.map(cat => {
                  const rows = calcResult.results.filter(r => r.category === cat)
                  if (rows.length === 0) return null
                  return (
                    <div key={cat}>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 print:break-after-avoid">{cat}</h3>
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="border-b-2 border-gray-800 text-xs text-gray-600 uppercase tracking-wide">
                            <th className="text-left font-medium py-2 pr-2">Nutrient</th>
                            <th className="text-right font-medium py-2 px-2">Per 100 g</th>
                            {showPerServing && (
                              <th className="text-right font-medium py-2 px-2">Per serving</th>
                            )}
                            <th className="text-right font-medium py-2 pl-2 w-16">Unit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map(r => (
                            <tr key={r.nutrientId} className="border-b border-gray-200">
                              <td className="py-1.5 pr-2 text-gray-900">{r.name}</td>
                              <td className="py-1.5 px-2 text-right tabular-nums text-gray-800">
                                {formatAmt(r.perFinished100g, r.unit)}
                              </td>
                              {showPerServing && (
                                <td className="py-1.5 px-2 text-right tabular-nums text-gray-800">
                                  {r.perServing != null ? formatAmt(r.perServing, r.unit) : '—'}
                                </td>
                              )}
                              <td className="py-1.5 pl-2 text-right text-gray-600">{r.unit}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Validation vs project targets */}
        {showValidation && (
          <div className="mb-6">
            <h2 className={SECTION_HEADING}>Validation vs project targets</h2>
            {projectTargets.length === 0 ? (
              <p className="text-sm text-gray-500">No targets defined for this project.</p>
            ) : nutrientsLoading ? (
              <p className="text-sm text-gray-400">Loading…</p>
            ) : nutrientsError ? (
              <p className="text-sm text-gray-500">Could not load nutrient data.</p>
            ) : !calcResult ? (
              <p className="text-sm text-gray-500">No ingredients to validate.</p>
            ) : (
              <>
                <p className="mb-2 text-xs text-gray-600">
                  {validations.filter(v => v.status === 'pass').length} pass
                  {' · '}{validations.filter(v => v.status === 'warn').length} warn
                  {' · '}{validations.filter(v => v.status === 'fail').length} fail
                </p>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-800 text-xs text-gray-600 uppercase tracking-wide">
                      <th className="text-left font-medium py-2 pr-2">Nutrient</th>
                      <th className="text-left font-medium py-2 px-2">Requirement</th>
                      <th className="text-right font-medium py-2 px-2">Actual</th>
                      <th className="text-center font-medium py-2 pl-2 w-16">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validations.map(({ t, status, actual }, i) => (
                      <tr key={i} className="border-b border-gray-200">
                        <td className="py-1.5 pr-2 text-gray-900">{t.label || t.nutrient}</td>
                        <td className="py-1.5 px-2 text-gray-700">
                          {fmtRequirement(t)}{' '}
                          <span className="text-gray-500">/ {t.basis === 'per_100g' ? '100 g' : 'serving'}</span>
                        </td>
                        <td className="py-1.5 px-2 text-right tabular-nums text-gray-800">
                          {actual != null
                            ? `${formatAmt(actual, t.unit)} ${t.unit}`
                            : <span className="text-gray-500 text-xs">
                                {t.basis === 'per_serving' && !servingSizeG ? 'set serving size' : '—'}
                              </span>
                          }
                        </td>
                        <td className={`py-1.5 pl-2 text-center text-gray-900 ${status === 'fail' ? 'font-semibold' : ''}`}>
                          {STATUS_LABEL[status]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
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
