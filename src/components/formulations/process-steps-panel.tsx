'use client'

import { useEffect, useLayoutEffect, useRef, useState, type TextareaHTMLAttributes } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { GripVertical, Plus, X, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import type { Equipment, ProcessStepDetail } from '@/lib/types'
import { hasStepLoss, type LossType, type LossUnit } from '@/lib/process-loss'
import type { StepParams } from '@/lib/step-measurements'
import { StepMeasurements } from '@/components/formulations/step-measurements'
import { EquipmentManagerDialog } from '@/components/formulations/equipment-manager-dialog'
import { Term } from '@/components/term'

type LossDraft = { type: LossType | ''; amount: string; unit: LossUnit }
/** A step's losses in the order they apply: the second is taken from what's left after the first */
type LossDrafts = [LossDraft, LossDraft]

// A one-paragraph text box that wraps long instructions and grows to fit them, so the whole step is
// readable without scrolling. Enter doesn't add a line break: it runs onEnter (or just leaves the field).
function StepTextArea({ onEnter, onKeyDown, onInput, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { onEnter?: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const fit = () => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`
  }
  useLayoutEffect(fit, [props.value, props.defaultValue])
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    let width = el.clientWidth
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== width) { width = el.clientWidth; fit() }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <textarea
      {...props}
      ref={ref}
      rows={1}
      onInput={(e) => { fit(); onInput?.(e) }}
      onKeyDown={(e) => {
        onKeyDown?.(e)
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
          e.preventDefault()
          if (onEnter) onEnter()
          else e.currentTarget.blur()
        }
      }}
      className={`${props.className ?? ''} block resize-none overflow-hidden whitespace-pre-wrap break-words`}
    />
  )
}

/** Steps are one paragraph: pasted line breaks become spaces. */
const oneLine = (s: string) => s.replace(/\s*[\r\n]+\s*/g, ' ')

const NO_LOSS: LossDraft = { type: '', amount: '', unit: 'g' }

const LOSS_HINT: Record<LossType, string> = {
  production: 'Product left behind (paddle, bowl, pan) — yield drops, nutrient profile unchanged',
  moisture: 'Water driven off (baking, boiling, drying) — yield drops, nutrient profile concentrates',
}

function toDraft(type: string | null, amount: string | null, unit: string | null): LossDraft {
  if (type !== 'production' && type !== 'moisture') return NO_LOSS
  return { type, amount: amount != null ? String(parseFloat(amount)) : '', unit: unit === 'pct' ? 'pct' : 'g' }
}

/** With the first loss removed, the second one moves up */
function normalizeDrafts([a, b]: LossDrafts): LossDrafts {
  return a.type ? [a, b] : [b, NO_LOSS]
}

function stepLossDrafts(step: ProcessStepDetail): LossDrafts {
  return normalizeDrafts([
    toDraft(step.lossType, step.lossAmount, step.lossUnit),
    toDraft(step.loss2Type, step.loss2Amount, step.loss2Unit),
  ])
}

/** Why a draft can't be saved yet, or null when it is a valid loss (or no loss). */
function lossDraftError(d: LossDraft): string | null {
  if (!d.type) return null
  const n = parseFloat(d.amount)
  if (!(n > 0)) return 'Enter an amount'
  if (d.unit === 'pct' && n > 100) return 'Max 100%'
  return null
}

const draftsError = ([a, b]: LossDrafts) => lossDraftError(a) ?? lossDraftError(b)

function lossBody([a, b]: LossDrafts) {
  if (!a.type) return { lossType: null }
  return {
    lossType: a.type, lossAmount: parseFloat(a.amount), lossUnit: a.unit,
    ...(b.type ? { loss2Type: b.type, loss2Amount: parseFloat(b.amount), loss2Unit: b.unit } : { loss2Type: null }),
  }
}

const SELECT_CLASS = `px-1.5 py-1 text-xs border border-gray-200 rounded bg-white
                      focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50`

function LossRow({
  draft, onChange, onCommit, disabled, second = false,
}: {
  draft: LossDraft
  onChange: (d: LossDraft) => void
  /** Called with the changed draft when the change should be saved */
  onCommit: (d: LossDraft) => void
  disabled: boolean
  /** The loss applied after the first one */
  second?: boolean
}) {
  const error = lossDraftError(draft)
  const set = (next: LossDraft) => { onChange(next); onCommit(next) }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {second && <span className="text-[10px] text-gray-400">then</span>}
      <select
        value={draft.type}
        disabled={disabled}
        onChange={(e) => {
          const type = e.target.value as LossDraft['type']
          set(type ? { ...draft, type } : NO_LOSS)
        }}
        aria-label={second ? 'Second loss type' : 'Loss type'}
        data-tip={second
          ? 'A second loss at this step, applied after the first. Pick “No loss” to remove it.'
          : 'Production loss: product left on equipment, per-100 g nutrition unchanged. Moisture loss: water driven off, nutrition concentrates.'}
        className={SELECT_CLASS}
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
            onBlur={() => onCommit(draft)}
            aria-label={second ? 'Second loss amount' : 'Loss amount'}
            data-tip={draft.unit === 'pct'
              ? (second ? 'Loss as a % of what’s left after the first loss' : 'Loss as a % of the weight going into this step, after earlier losses')
              : 'Grams lost in this step. Saves when you click away.'}
            placeholder="Amount"
            className="w-20 px-1.5 py-1 text-xs border border-gray-200 rounded tabular-nums
                       focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <select
            value={draft.unit}
            disabled={disabled}
            onChange={(e) => set({ ...draft, unit: e.target.value as LossUnit })}
            aria-label={second ? 'Second loss unit' : 'Loss unit'}
            data-tip={second
              ? 'Grams, or a % of what’s left after the first loss'
              : 'Grams, or a % of the weight going into this step (after any earlier losses)'}
            className={SELECT_CLASS}
          >
            <option value="g">g</option>
            <option value="pct">{second ? '% of what’s left' : '% of batch'}</option>
          </select>
          {error && <span className="text-[10px] text-amber-600">{error}</span>}
        </>
      )}
    </div>
  )
}

function LossFields({
  drafts, onChange, onCommit, disabled,
}: {
  drafts: LossDrafts
  onChange: (d: LossDrafts) => void
  /** Called with the drafts to persist, whenever a change leaves them valid. */
  onCommit?: (d: LossDrafts) => void
  disabled: boolean
}) {
  const [first, second] = drafts

  function update(next: LossDrafts, commit: boolean) {
    const normalized = normalizeDrafts(next)
    onChange(normalized)
    if (commit && !draftsError(normalized)) onCommit?.(normalized)
  }

  const types = [first.type, second.type].filter((t): t is LossType => !!t)

  return (
    <div className="space-y-1">
      <LossRow
        draft={first}
        disabled={disabled}
        onChange={(d) => update([d, second], false)}
        onCommit={(d) => update([d, second], true)}
      />
      {first.type && second.type && (
        <LossRow
          second
          draft={second}
          disabled={disabled}
          onChange={(d) => update([first, d], false)}
          onCommit={(d) => update([first, d], true)}
        />
      )}
      {first.type && !second.type && !disabled && (
        <button
          type="button"
          // Opens a second loss of the other type; it saves once it has an amount
          onClick={() => update([first, { type: first.type === 'moisture' ? 'production' : 'moisture', amount: '', unit: first.unit }], false)}
          data-tip="Adds a second loss at this step, applied after the first, e.g. moisture driven off in a centrifuge, then product left inside it"
          className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-700 transition-colors"
        >
          <Plus size={10} /> Then another loss
        </button>
      )}
      {types.length === 1 && <p className="text-[10px] text-gray-400">{LOSS_HINT[types[0]]}</p>}
      {types.length === 2 && (
        <p className="text-[10px] text-gray-400">Applied in this order: the second loss is taken from what’s left after the first</p>
      )}
    </div>
  )
}

function StepLoss({
  step, disabled, onCommit,
}: {
  step: ProcessStepDetail
  disabled: boolean
  onCommit: (d: LossDrafts) => void
}) {
  const [drafts, setDrafts] = useState(() => stepLossDrafts(step))
  // Pick up saved values (e.g. after a refetch)
  const saved = JSON.stringify(stepLossDrafts(step))
  useEffect(() => { setDrafts(JSON.parse(saved)) }, [saved])

  return (
    <LossFields
      drafts={drafts}
      onChange={setDrafts}
      disabled={disabled}
      onCommit={(d) => { if (JSON.stringify(d) !== saved) onCommit(d) }}
    />
  )
}

// Whether the panel is collapsed: a per-browser view preference shared by every formulation
const COLLAPSED_KEY = 'processStepsCollapsed'

function readCollapsed(): boolean {
  try { return window.localStorage.getItem(COLLAPSED_KEY) === '1' } catch { return false }
}

function writeCollapsed(collapsed: boolean): void {
  try { window.localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0') } catch { /* storage unavailable */ }
}

async function jsonOrThrow(r: Response) {
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(body.error ?? 'Request failed')
  return body
}

/** What happens to the batch at one step, from the formula grid (see lib/staged-additions.ts) */
export type StepStage = {
  /** Batch weight leaving the step, after its loss */
  massAfterG: number
  /** Ingredients added after the step; pct is of massAfterG */
  added: Array<{ name: string; weightG: number; pct: number; pctLocked: boolean }>
}

// Enough places for a small usage % like 0.10% without trailing noise
const formatPct = (pct: number) => Number(pct.toFixed(pct < 1 ? 3 : 2)).toString()

export function ProcessStepsPanel({
  formulationId,
  steps,
  stages,
  formatWeight = g => `${Number(g.toFixed(1))} g`,
  isLocked,
  canEditLibrary,
}: {
  formulationId: string
  steps: ProcessStepDetail[]
  /** By step id; shown under each step once any step has a loss or an ingredient added after it */
  stages?: Record<string, StepStage>
  formatWeight?: (g: number) => string
  isLocked: boolean
  /** The equipment list belongs to the library, so renaming or removing needs library edit access */
  canEditLibrary: boolean
}) {
  const queryClient = useQueryClient()
  const [managingEquipment, setManagingEquipment] = useState(false)
  const [ordered, setOrdered] = useState(steps)
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [newInstruction, setNewInstruction] = useState('')
  const [newLoss, setNewLoss] = useState<LossDrafts>([NO_LOSS, NO_LOSS])
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => { setCollapsed(readCollapsed()) }, [])

  function toggleCollapsed() {
    setCollapsed(!collapsed)
    writeCollapsed(!collapsed)
  }

  useEffect(() => {
    setOrdered(steps)
  }, [steps])

  // Shared list of equipment any step can pick from. Always treated as stale so it is re-fetched on
  // page load and tab focus: equipment added in another tab/formulation shows up here too.
  const { data: equipment = [] } = useQuery<Equipment[]>({
    queryKey: ['equipment'],
    queryFn: () => fetch('/api/equipment').then(jsonOrThrow),
    staleTime: 0,
  })

  const showFlow = steps.some(hasStepLoss) || Object.values(stages ?? {}).some(s => s.added.length > 0)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['formulation', formulationId] })
  }

  const addMutation = useMutation({
    mutationFn: ({ instruction, loss }: { instruction: string; loss: LossDrafts }) =>
      fetch(`/api/formulations/${formulationId}/process-steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction, ...(loss[0].type ? lossBody(loss) : {}) }),
      }).then(jsonOrThrow),
    onSuccess: () => {
      setNewInstruction('')
      setNewLoss([NO_LOSS, NO_LOSS])
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
    if (draftsError(newLoss)) {
      toast.error('Enter each loss amount, or set the loss to "No loss"')
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
      // Available everywhere in this session straight away; the re-fetch then confirms it
      queryClient.setQueryData<Equipment[]>(['equipment'], (list = []) =>
        list.some((eq) => eq.id === created.id)
          ? list
          : [...list, created].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
      )
      queryClient.invalidateQueries({ queryKey: ['equipment'] })
      patchMutation.mutate({ stepId, body: { equipmentId: created.id } })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add equipment')
      throw err
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-expanded={!collapsed}
        data-tip={collapsed ? 'Shows the method steps, with their losses and measurements' : 'Hides the process steps (remembered in this browser)'}
        className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 hover:text-gray-600 transition-colors"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        Process steps
        <span className="text-xs text-gray-400 font-normal">
          ({ordered.length} step{ordered.length !== 1 ? 's' : ''})
        </span>
      </button>

      {!collapsed && ordered.length > 0 && (
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
                    data-tip={!isLocked ? 'Drag to reorder this step' : undefined}
                  >
                    {!isLocked && <GripVertical size={14} className="text-gray-300 hover:text-gray-500 transition-colors" />}
                  </div>

                  <button
                    onClick={() => toggleExpanded(step.id)}
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? 'Hide more measurements' : 'Show more measurements'}
                    data-tip={isExpanded ? 'Hides solids, shear and pressure' : 'Shows more measurements: solids (%), shear and pressure'}
                    className="pt-1 text-gray-400 hover:text-gray-600"
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>

                  <span className="flex-none w-6 pt-1 text-xs font-medium text-gray-400 tabular-nums">
                    {i + 1}
                  </span>

                  <div className="flex-1 space-y-2">
                    <StepTextArea
                      defaultValue={step.instruction}
                      disabled={isLocked}
                      aria-label="Step instruction"
                      data-tip={isLocked ? undefined : 'Click to edit the instruction. Saves when you click away.'}
                      onBlur={(e) => {
                        const value = oneLine(e.target.value).trim()
                        if (value && value !== step.instruction) {
                          e.target.value = value
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
                        <span className="block text-[10px] text-gray-400">
                          <Term tip="Weight lost in this step. It lowers the yield; a moisture loss also concentrates the nutrition per 100 g. A step can have two losses, applied in the order entered.">Loss</Term>
                        </span>
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
                        onRefreshEquipment={() => queryClient.invalidateQueries({ queryKey: ['equipment'] })}
                        onManageEquipment={canEditLibrary ? () => setManagingEquipment(true) : undefined}
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
                              aria-label={label}
                              data-tip={isLocked ? undefined : 'Free text, e.g. a value with its unit. Saves when you click away.'}
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

                    {showFlow && stages?.[step.id] && (
                      <div className="px-2 text-[11px] text-gray-500">
                        <Term tip="The batch weight once this step’s loss is applied, from the formula’s current amounts (unsaved changes included).">
                          {formatWeight(stages[step.id].massAfterG)} leaves this step
                        </Term>
                        {stages[step.id].added.length > 0 && (
                          <span className="text-indigo-700">
                            {' · then add '}
                            {stages[step.id].added.map(a => (
                              `${a.name} ${formatPct(a.pct)}% (${formatWeight(a.weightG)})${a.pctLocked ? '' : ', fixed amount'}`
                            )).join(', ')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {!isLocked && (
                    <button
                      onClick={() => deleteMutation.mutate(step.id)}
                      aria-label="Delete step"
                      data-tip="Deletes this step straight away (no confirmation)"
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

      {!collapsed && !isLocked && (
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <StepTextArea
              value={newInstruction}
              onChange={(e) => setNewInstruction(oneLine(e.target.value))}
              onEnter={handleAdd}
              placeholder="Add a process step, e.g. Bake at 175°C for 25 minutes"
              className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-md
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleAdd}
              disabled={addMutation.isPending || !newInstruction.trim()}
              data-tip={newInstruction.trim() ? 'Adds this step to the end of the method. Steps save by themselves.' : 'Type an instruction first'}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-900 text-white
                         rounded-md hover:bg-gray-800 disabled:opacity-40 transition-colors"
            >
              {addMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Add step
            </button>
          </div>
          <LossFields drafts={newLoss} onChange={setNewLoss} disabled={false} />
        </div>
      )}

      {managingEquipment && <EquipmentManagerDialog onClose={() => setManagingEquipment(false)} />}
    </div>
  )
}
