'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { GripVertical, Plus, X, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import type { Equipment, ProcessStepDetail } from '@/lib/types'
import type { LossType, LossUnit } from '@/lib/process-loss'
import type { StepParams } from '@/lib/step-measurements'
import { StepMeasurements } from '@/components/formulations/step-measurements'

type LossDraft = { type: LossType | ''; amount: string; unit: LossUnit }

const NO_LOSS: LossDraft = { type: '', amount: '', unit: 'g' }

const LOSS_HINT: Record<LossType, string> = {
  production: 'Product left behind (paddle, bowl, pan) — yield drops, nutrient profile unchanged',
  moisture: 'Water driven off (baking, boiling, drying) — yield drops, nutrient profile concentrates',
}

function stepLossDraft(step: ProcessStepDetail): LossDraft {
  if (step.lossType !== 'production' && step.lossType !== 'moisture') return NO_LOSS
  return {
    type: step.lossType,
    amount: step.lossAmount != null ? String(parseFloat(step.lossAmount)) : '',
    unit: step.lossUnit === 'pct' ? 'pct' : 'g',
  }
}

/** Why a draft can't be saved yet, or null when it is a valid loss (or no loss). */
function lossDraftError(d: LossDraft): string | null {
  if (!d.type) return null
  const n = parseFloat(d.amount)
  if (!(n > 0)) return 'Enter an amount'
  if (d.unit === 'pct' && n > 100) return 'Max 100%'
  return null
}

function lossBody(d: LossDraft) {
  return d.type
    ? { lossType: d.type, lossAmount: parseFloat(d.amount), lossUnit: d.unit }
    : { lossType: null }
}

function LossFields({
  draft, onChange, onCommit, disabled,
}: {
  draft: LossDraft
  onChange: (d: LossDraft) => void
  /** Called with the draft to persist, whenever a change leaves it valid. */
  onCommit?: (d: LossDraft) => void
  disabled: boolean
}) {
  const error = lossDraftError(draft)

  function update(next: LossDraft, commit: boolean) {
    onChange(next)
    if (commit && !lossDraftError(next)) onCommit?.(next)
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={draft.type}
          disabled={disabled}
          onChange={(e) => {
            const type = e.target.value as LossDraft['type']
            update(type ? { ...draft, type } : NO_LOSS, true)
          }}
          aria-label="Loss type"
          className="px-1.5 py-1 text-xs border border-gray-200 rounded bg-white
                     focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <option value="">No loss</option>
          <option value="production">Production loss</option>
          <option value="moisture">Moisture loss</option>
        </select>
        {draft.type && (
          <>
            <input
              type="number"
              min="0"
              max={draft.unit === 'pct' ? 100 : undefined}
              step="any"
              value={draft.amount}
              disabled={disabled}
              onChange={(e) => onChange({ ...draft, amount: e.target.value })}
              onBlur={() => update(draft, true)}
              aria-label="Loss amount"
              placeholder="Amount"
              className="w-20 px-1.5 py-1 text-xs border border-gray-200 rounded tabular-nums
                         focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <select
              value={draft.unit}
              disabled={disabled}
              onChange={(e) => update({ ...draft, unit: e.target.value as LossUnit }, true)}
              aria-label="Loss unit"
              className="px-1.5 py-1 text-xs border border-gray-200 rounded bg-white
                         focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="g">g</option>
              <option value="pct">% of batch</option>
            </select>
            {error && <span className="text-[10px] text-amber-600">{error}</span>}
          </>
        )}
      </div>
      {draft.type && <p className="text-[10px] text-gray-400">{LOSS_HINT[draft.type]}</p>}
    </div>
  )
}

function StepLoss({
  step, disabled, onCommit,
}: {
  step: ProcessStepDetail
  disabled: boolean
  onCommit: (d: LossDraft) => void
}) {
  const [draft, setDraft] = useState(() => stepLossDraft(step))
  // Pick up saved values (e.g. after a refetch)
  const saved = JSON.stringify(stepLossDraft(step))
  useEffect(() => { setDraft(JSON.parse(saved)) }, [saved])

  return (
    <LossFields
      draft={draft}
      onChange={setDraft}
      disabled={disabled}
      onCommit={(d) => { if (JSON.stringify(d) !== saved) onCommit(d) }}
    />
  )
}

async function jsonOrThrow(r: Response) {
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(body.error ?? 'Request failed')
  return body
}

export function ProcessStepsPanel({
  formulationId,
  steps,
  isLocked,
}: {
  formulationId: string
  steps: ProcessStepDetail[]
  isLocked: boolean
}) {
  const queryClient = useQueryClient()
  const [ordered, setOrdered] = useState(steps)
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [newInstruction, setNewInstruction] = useState('')
  const [newLoss, setNewLoss] = useState<LossDraft>(NO_LOSS)

  useEffect(() => {
    setOrdered(steps)
  }, [steps])

  // Shared list of equipment any step can pick from
  const { data: equipment = [] } = useQuery<Equipment[]>({
    queryKey: ['equipment'],
    queryFn: () => fetch('/api/equipment').then(jsonOrThrow),
    staleTime: 60_000,
  })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['formulation', formulationId] })
  }

  const addMutation = useMutation({
    mutationFn: ({ instruction, loss }: { instruction: string; loss: LossDraft }) =>
      fetch(`/api/formulations/${formulationId}/process-steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction, ...(loss.type ? lossBody(loss) : {}) }),
      }).then(jsonOrThrow),
    onSuccess: () => {
      setNewInstruction('')
      setNewLoss(NO_LOSS)
      invalidate()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to add step'),
  })

  const patchMutation = useMutation({
    mutationFn: ({ stepId, body }: { stepId: string; body: Record<string, unknown> }) =>
      fetch(`/api/formulations/${formulationId}/process-steps/${stepId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(jsonOrThrow),
    onSuccess: invalidate,
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to update step'),
  })

  const deleteMutation = useMutation({
    mutationFn: (stepId: string) =>
      fetch(`/api/formulations/${formulationId}/process-steps/${stepId}`, { method: 'DELETE' }).then(jsonOrThrow),
    onSuccess: invalidate,
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to delete step'),
  })

  const reorderMutation = useMutation({
    mutationFn: (order: string[]) =>
      fetch(`/api/formulations/${formulationId}/process-steps/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      }).then(jsonOrThrow),
    onSuccess: invalidate,
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to reorder steps')
      setOrdered(steps)
    },
  })

  function reorder(fromId: string, toId: string) {
    if (fromId === toId) return
    setOrdered((prev) => {
      const arr = [...prev]
      const fi = arr.findIndex((s) => s.id === fromId)
      const ti = arr.findIndex((s) => s.id === toId)
      if (fi === -1 || ti === -1) return prev
      const [moved] = arr.splice(fi, 1)
      arr.splice(ti, 0, moved)
      reorderMutation.mutate(arr.map((s) => s.id))
      return arr
    })
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleAdd() {
    const instruction = newInstruction.trim()
    if (!instruction) return
    if (lossDraftError(newLoss)) {
      toast.error('Enter a loss amount, or set the loss to "No loss"')
      return
    }
    addMutation.mutate({ instruction, loss: newLoss })
  }

  // The server merges these keys into the step's params; null clears one
  function patchParams(stepId: string, params: Record<string, string | null>) {
    patchMutation.mutate({ stepId, body: { params } })
  }

  // Adds (or reuses, ignoring case) a piece of equipment, then assigns it to the step
  async function createEquipment(stepId: string, name: string) {
    try {
      const created: Equipment = await fetch('/api/equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      }).then(jsonOrThrow)
      await queryClient.invalidateQueries({ queryKey: ['equipment'] })
      patchMutation.mutate({ stepId, body: { equipmentId: created.id } })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add equipment')
      throw err
    }
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-900">Process steps</h2>

      {ordered.length > 0 && (
        <div className="border border-gray-100 rounded-lg overflow-hidden divide-y divide-gray-50">
          {ordered.map((step, i) => {
            const isBeingDragged = dragKey === step.id
            const isDropTarget = dragOverKey === step.id && dragKey !== step.id
            const isExpanded = expanded.has(step.id)
            const p = (step.params ?? {}) as StepParams

            return (
              <div
                key={step.id}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverKey(step.id) }}
                onDrop={(e) => { e.preventDefault(); if (dragKey) reorder(dragKey, step.id); setDragOverKey(null) }}
                onDragEnd={() => { setDragKey(null); setDragOverKey(null) }}
                data-step-row
                className={`transition-colors ${
                  isBeingDragged ? 'opacity-40 bg-blue-50' :
                  isDropTarget ? 'border-t-2 border-blue-400 bg-blue-50/40' :
                  'bg-white'
                }`}
              >
                <div className="flex items-start gap-2 px-3 py-2.5">
                  <div
                    // Only the handle drags: a draggable row would hijack click-drag text selection in the inputs
                    draggable={!isLocked}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move'
                      const row = e.currentTarget.closest('[data-step-row]')
                      if (row) e.dataTransfer.setDragImage(row, 16, 16)
                      setDragKey(step.id)
                    }}
                    className={`pt-1 ${!isLocked ? 'cursor-grab active:cursor-grabbing' : ''}`}
                  >
                    {!isLocked && <GripVertical size={14} className="text-gray-300 hover:text-gray-500 transition-colors" />}
                  </div>

                  <button
                    onClick={() => toggleExpanded(step.id)}
                    className="pt-1 text-gray-400 hover:text-gray-600"
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>

                  <span className="flex-none w-6 pt-1 text-xs font-medium text-gray-400 tabular-nums">
                    {i + 1}
                  </span>

                  <div className="flex-1 space-y-2">
                    <input
                      defaultValue={step.instruction}
                      disabled={isLocked}
                      onBlur={(e) => {
                        const value = e.target.value.trim()
                        if (value && value !== step.instruction) {
                          patchMutation.mutate({ stepId: step.id, body: { instruction: value } })
                        } else if (!value) {
                          e.target.value = step.instruction
                        }
                      }}
                      className="w-full px-2 py-1 text-sm border border-transparent rounded-md
                                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                                 disabled:bg-transparent"
                    />

                    <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                      <div className="space-y-0.5">
                        <span className="block text-[10px] text-gray-400">Loss</span>
                        <StepLoss
                          step={step}
                          disabled={isLocked}
                          onCommit={(d) => patchMutation.mutate({ stepId: step.id, body: lossBody(d) })}
                        />
                      </div>
                      <StepMeasurements
                        step={step}
                        disabled={isLocked}
                        equipment={equipment}
                        onPatch={(params) => patchParams(step.id, params)}
                        onSelectEquipment={(id) => patchMutation.mutate({ stepId: step.id, body: { equipmentId: id } })}
                        onCreateEquipment={(name) => createEquipment(step.id, name)}
                      />
                    </div>

                    {isExpanded && (
                      <div className="grid grid-cols-3 gap-2 pt-1 pb-1 max-w-md">
                        {([
                          ['solids_pct', 'Solids (%)'],
                          ['shear', 'Shear'],
                          ['pressure', 'Pressure'],
                        ] as const).map(([key, label]) => (
                          <div key={key} className="space-y-0.5">
                            <label className="text-[10px] text-gray-400">{label}</label>
                            <input
                              defaultValue={p[key] ?? ''}
                              disabled={isLocked}
                              onBlur={(e) => {
                                const next = e.target.value.trim()
                                if (next !== (p[key] ?? '')) patchParams(step.id, { [key]: next || null })
                              }}
                              className="w-full px-1.5 py-1 text-xs border border-gray-200 rounded
                                         focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {!isLocked && (
                    <button
                      onClick={() => deleteMutation.mutate(step.id)}
                      className="pt-1 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!isLocked && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              value={newInstruction}
              onChange={(e) => setNewInstruction(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
              placeholder="Add a process step, e.g. Bake at 175°C for 25 minutes"
              className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-md
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleAdd}
              disabled={addMutation.isPending || !newInstruction.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-900 text-white
                         rounded-md hover:bg-gray-800 disabled:opacity-40 transition-colors"
            >
              {addMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Add step
            </button>
          </div>
          <LossFields draft={newLoss} onChange={setNewLoss} disabled={false} />
        </div>
      )}
    </div>
  )
}
