'use client'

import { useState } from 'react'
import type { PrintSection } from '@/lib/print-sections'

type Option = {
  key: PrintSection
  label: string
  hint: string
  disabledHint?: string  // set when the option is unavailable
}

// Render only while open (like the other inline dialogs) so the checkbox state
// resets to the defaults on every open.
export function PrintOptionsDialog({
  hasSteps,
  hasTargets,
  hasLines,
  onClose,
  onConfirm,
}: {
  hasSteps: boolean
  hasTargets: boolean
  hasLines: boolean
  onClose: () => void
  onConfirm: (sections: PrintSection[]) => void
}) {
  const [checked, setChecked] = useState<Record<PrintSection, boolean>>({
    formulation: true,
    process: hasSteps,
    nutrients: false,
    validation: false,
  })

  const options: Option[] = [
    {
      key: 'formulation',
      label: 'Formulation',
      hint: 'Ingredients, batch settings and notes',
    },
    {
      key: 'process',
      label: 'Process steps',
      hint: 'Ordered steps with parameters',
      disabledHint: hasSteps ? undefined : 'No process steps defined',
    },
    {
      key: 'nutrients',
      label: 'Full nutrient profile',
      hint: 'All nutrients per 100 g and per serving',
      disabledHint: hasLines ? undefined : 'Add ingredients first',
    },
    {
      key: 'validation',
      label: 'Validation vs project targets',
      hint: 'Pass / warn / fail for each project target',
      disabledHint: !hasTargets ? 'Project has no targets' : !hasLines ? 'Add ingredients first' : undefined,
    },
  ]

  const selected = (Object.keys(checked) as PrintSection[]).filter(k => checked[k])
  const canPrint = selected.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <form
        className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-5 space-y-4"
        onSubmit={e => {
          e.preventDefault()
          if (canPrint) onConfirm(selected)
        }}
      >
        <h3 className="text-base font-semibold text-gray-900">Print formulation</h3>
        <p className="text-sm text-gray-500">Choose which sections to include.</p>
        <div className="space-y-3">
          {options.map(o => {
            const disabled = !!o.disabledHint
            return (
              <label
                key={o.key}
                className={`flex items-start gap-2 ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
              >
                <input
                  type="checkbox"
                  className="rounded border-gray-300 mt-0.5"
                  checked={checked[o.key] && !disabled}
                  disabled={disabled}
                  onChange={e => setChecked(prev => ({ ...prev, [o.key]: e.target.checked }))}
                />
                <span>
                  <span className="text-sm text-gray-800 block">{o.label}</span>
                  <span className="text-xs text-gray-400 block">{o.disabledHint ?? o.hint}</span>
                </span>
              </label>
            )
          })}
        </div>
        {!canPrint && <p className="text-xs text-red-500">Select at least one section.</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={!canPrint}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
            Print
          </button>
        </div>
      </form>
    </div>
  )
}
