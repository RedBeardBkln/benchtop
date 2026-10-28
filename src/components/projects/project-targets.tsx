'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react'
import type { Nutrient, ProjectTarget } from '@/lib/types'
import { Term } from '@/components/term'
import { PCT_DV, PCT_OF_100G, convertToUnit, isPctUnit, unitLabel, vitaminUnitOptions, withUnit } from '@/lib/units'

const COMPARATOR_LABELS: Record<string, string> = {
  '>=': '≥ min',
  '<=': '≤ max',
  '=':  '= exact',
  'range': 'between',
}

const EMPTY_TARGET = (): ProjectTarget => ({
  nutrient: null,
  label: '',
  comparator: '>=',
  value: 0,
  unit: 'g',
  basis: 'per_100g',
})

const UNIT_TIP = 'The nutrient’s own unit, % of 100g (a share of the product’s weight: 20% = 20 g in every 100 g), or % DV (a share of the FDA Daily Value). Vitamins A, D and E can also be given in IU, and folate as folic acid; Benchtop converts them for that vitamin.'

/**
 * Units a target can be given in: the nutrient's own, a vitamin's other forms (IU, folic acid…),
 * % of 100g for nutrients measured by weight, and % DV for nutrients with a Daily Value.
 * `ok: false` keeps a saved unit that no longer fits listed.
 */
function targetUnitOptions(
  nutrient: Nutrient | undefined,
  current: string,
): Array<{ value: string; label: string; ok: boolean }> {
  const base = nutrient?.unit ?? (isPctUnit(current) ? 'g' : current)
  const dv = nutrient?.dailyValueAmount != null ? parseFloat(nutrient.dailyValueAmount) : null
  const opts = [{ value: base, label: base, ok: true }]
  const forms = vitaminUnitOptions(nutrient?.name).filter(f => f.value !== base)
  opts.push(...forms.map(f => ({ ...f, ok: true })))
  if (current !== base && !isPctUnit(current) && !forms.some(f => f.value === current)) {
    opts.push({ value: current, label: unitLabel(current, nutrient?.name), ok: true })
  }
  const byWeight = convertToUnit(1, base, 'g') != null
  if (byWeight || current === PCT_OF_100G) opts.push({ value: PCT_OF_100G, label: '% of 100g', ok: byWeight })
  const hasDv = !!dv && dv > 0
  if (hasDv || current === PCT_DV) opts.push({ value: PCT_DV, label: '% DV', ok: hasDv })
  return opts
}

function fmtTarget(t: ProjectTarget): string {
  const v = withUnit(t.value, t.unit, t.nutrient)
  if (t.comparator === 'range') return `${t.value} – ${withUnit(t.valueMax ?? '?', t.unit, t.nutrient)}`
  if (t.comparator === '>=') return `≥ ${v}`
  if (t.comparator === '<=') return `≤ ${v}`
  return `= ${v}`
}

const control = 'px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white'

/** A form control with a small label above it */
function Field({ label, className, children }: { label: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <div className="text-[11px] font-medium text-gray-500 mb-1">{label}</div>
      {children}
    </div>
  )
}

function TargetForm({
  initial,
  nutrients,
  onSave,
  onCancel,
  saving,
}: {
  initial: ProjectTarget
  nutrients: Nutrient[] | undefined
  onSave: (t: ProjectTarget) => void
  onCancel: () => void
  saving: boolean
}) {
  const [draft, setDraft] = useState<ProjectTarget>(initial)

  const nutrient = nutrients?.find(n => n.name === draft.nutrient)
  const unitOptions = targetUnitOptions(nutrient, draft.unit)

  function handleNutrientChange(name: string) {
    const n = nutrients?.find(n => n.name === name)
    setDraft(d => {
      // Keep a % choice when the new nutrient allows it; otherwise use the nutrient's unit
      const keep = isPctUnit(d.unit) && targetUnitOptions(n, d.unit).some(o => o.value === d.unit && o.ok)
      return { ...d, nutrient: name || null, label: name || d.label, unit: keep ? d.unit : n?.unit ?? d.unit }
    })
  }

  function handleUnitChange(unit: string) {
    // A % of weight is grams per 100 g, so it's always per 100g
    setDraft(d => ({ ...d, unit, ...(unit === PCT_OF_100G ? { basis: 'per_100g' as const, servingSizeG: undefined } : {}) }))
  }

  const unitOk = unitOptions.find(o => o.value === draft.unit)?.ok !== false
  const canSave = !!(draft.nutrient || draft.label.trim()) && draft.value > 0 && unitOk

  return (
    <div className="border border-blue-100 rounded-lg p-3 bg-blue-50/30 space-y-3">
      {/* What: the nutrient, the rule and the amount */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-[minmax(10rem,1fr)_auto_auto_auto] sm:items-end">
        <Field label="Nutrient" className="col-span-2 sm:col-span-1">
          <select
            value={draft.nutrient ?? ''}
            onChange={e => handleNutrientChange(e.target.value)}
            data-tip="The nutrient to check. Its unit (g, mg, kcal…) fills in automatically."
            className={`${control} w-full`}
          >
            <option value="">— select nutrient —</option>
            {nutrients?.map(n => <option key={n.id} value={n.name}>{n.name}</option>)}
          </select>
        </Field>

        <Field label="Rule">
          <select
            value={draft.comparator}
            onChange={e => setDraft(d => ({ ...d, comparator: e.target.value as ProjectTarget['comparator'] }))}
            data-tip="The rule: ≥ min (at least), ≤ max (no more than), = exact, or between (a min and a max)."
            className={`${control} w-full`}
          >
            {Object.entries(COMPARATOR_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>

        <Field label={draft.comparator === 'range' ? 'Min – max' : 'Value'}>
          <div className="flex items-center gap-1">
            <input
              type="number" min="0" step="any"
              value={draft.value || ''}
              onChange={e => setDraft(d => ({ ...d, value: parseFloat(e.target.value) || 0 }))}
              placeholder={draft.comparator === 'range' ? 'min' : 'value'}
              aria-label={draft.comparator === 'range' ? 'Minimum' : 'Value'}
              data-tip={draft.comparator === 'range' ? 'The lowest allowed amount. Must be greater than 0.' : 'The target amount. Must be greater than 0.'}
              className={`${control} w-20 tabular-nums`}
            />
            {draft.comparator === 'range' && (
              <>
                <span className="text-gray-400 text-sm">–</span>
                <input
                  type="number" min="0" step="any"
                  value={draft.valueMax ?? ''}
                  onChange={e => setDraft(d => ({ ...d, valueMax: parseFloat(e.target.value) || undefined }))}
                  placeholder="max"
                  aria-label="Maximum"
                  data-tip="The highest allowed amount"
                  className={`${control} w-20 tabular-nums`}
                />
              </>
            )}
          </div>
        </Field>

        <Field label="Unit">
          <select
            value={draft.unit}
            onChange={e => handleUnitChange(e.target.value)}
            data-tip={UNIT_TIP}
            className={`${control} w-full`}
          >
            {unitOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      </div>

      {/* How it's measured: per what, on what, and the reference serving when per serving */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:flex sm:flex-wrap sm:items-end">
        <Field label="Per">
          <select
            value={draft.basis}
            onChange={e => setDraft(d => ({
              ...d,
              basis: e.target.value as ProjectTarget['basis'],
              servingSizeG: e.target.value === 'per_100g' ? undefined : d.servingSizeG,
            }))}
            disabled={draft.unit === PCT_OF_100G || !!draft.dryBasis}
            data-tip={draft.dryBasis
              ? 'A dry-basis target is always per 100 g of dry matter.'
              : draft.unit === PCT_OF_100G
                ? 'A % of weight is always per 100 g: 20% means 20 g in every 100 g, and in every serving’s weight.'
                : 'per 100g: measured in 100 g of the finished product. per serving: measured in one serving.'}
            className={`${control} w-full sm:w-auto disabled:text-gray-400`}
          >
            <option value="per_100g">100 g</option>
            <option value="per_serving">serving</option>
          </select>
        </Field>

        <Field label="Measured on">
          <select
            value={draft.dryBasis ? 'dry' : 'as_is'}
            onChange={e => {
              const dry = e.target.value === 'dry'
              setDraft(d => ({ ...d, dryBasis: dry || undefined, ...(dry ? { basis: 'per_100g' as const, servingSizeG: undefined } : {}) }))
            }}
            data-tip="As is: the finished batch, water included. Dry basis: the dry matter only, with the water taken out, so the value doesn’t change with moisture. Dry basis needs every ingredient’s moisture %."
            className={`${control} w-full sm:w-auto`}
          >
            <option value="as_is">as is</option>
            <option value="dry">dry basis</option>
          </select>
        </Field>

        {draft.basis === 'per_serving' && (
          <Field
            label={<Term tip="A reference serving in grams. Used only for formulations that don’t have their own serving size.">Serving size</Term>}
            className="col-span-2 sm:col-span-1"
          >
            <div className="flex items-center gap-1.5">
              <input
                type="number" min="0.1" step="any"
                value={draft.servingSizeG ?? ''}
                onChange={e => setDraft(d => ({ ...d, servingSizeG: parseFloat(e.target.value) || undefined }))}
                placeholder="e.g. 240"
                className={`${control} w-24 tabular-nums`}
              />
              <span className="text-xs text-gray-400">g</span>
              {!draft.servingSizeG && <span className="text-xs text-gray-400">optional</span>}
            </div>
          </Field>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onSave(draft)}
          disabled={!canSave || saving}
          data-tip={canSave
            ? 'Saves the target to the project. Every formulation in it is checked against it.'
            : !unitOk
              ? 'This nutrient can’t be given in that unit. Choose another.'
              : 'Choose a nutrient and enter a value greater than 0 first.'}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Check size={12} />
          {saving ? 'Saving…' : 'Save target'}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export function ProjectTargets({
  projectId,
  initialTargets,
  readOnly = false,
}: {
  projectId: string
  initialTargets: ProjectTarget[]
  readOnly?: boolean
}) {
  const queryClient = useQueryClient()
  const [targets, setTargets] = useState<ProjectTarget[]>(initialTargets)
  const [addingNew, setAddingNew] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const { data: nutrients } = useQuery<Nutrient[]>({
    queryKey: ['nutrients-all'],
    queryFn: () => fetch('/api/nutrients').then(r => r.json()),
    staleTime: Infinity,
  })

  const saveMutation = useMutation({
    mutationFn: (newTargets: ProjectTarget[]) =>
      fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets: newTargets }),
      }).then(async r => {
        const body = await r.json()
        if (!r.ok) throw new Error(body.error ?? 'Save failed')
        return body
      }),
    onSuccess: (_data, newTargets) => {
      setTargets(newTargets)
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      // Formulation detail embeds project.targets; the Projects list shows project updatedAt
      queryClient.invalidateQueries({ queryKey: ['formulation'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Target saved')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function handleAdd(t: ProjectTarget) {
    const next = [...targets, t]
    saveMutation.mutate(next, {
      onSuccess: () => setAddingNew(false),
    })
  }

  function handleEdit(i: number, t: ProjectTarget) {
    const next = targets.map((x, idx) => idx === i ? t : x)
    saveMutation.mutate(next, {
      onSuccess: () => setEditingIndex(null),
    })
  }

  function handleRemove(i: number) {
    if (!confirm('Remove this target?')) return
    const next = targets.filter((_, idx) => idx !== i)
    saveMutation.mutate(next)
  }

  return (
    <div className="space-y-2">
      {/* Saved targets */}
      {targets.length === 0 && !addingNew ? (
        <p className="text-sm text-gray-400 py-2">
          No targets set. Add a target to validate formulations against nutritional requirements.
        </p>
      ) : (
        targets.map((t, i) =>
          editingIndex === i ? (
            <TargetForm
              key={i}
              initial={t}
              nutrients={nutrients}
              saving={saveMutation.isPending}
              onSave={updated => handleEdit(i, updated)}
              onCancel={() => setEditingIndex(null)}
            />
          ) : (
            <div
              key={i}
              className="flex items-center gap-3 px-3 py-2.5 border border-gray-100 rounded-lg bg-white hover:bg-gray-50/60 transition-colors group/row"
            >
              {/* Nutrient label */}
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-800">
                  {t.label || t.nutrient || '—'}
                </span>
              </div>

              {/* Requirement */}
              <span className="text-sm font-medium text-gray-700 tabular-nums shrink-0">
                {fmtTarget(t)}
              </span>

              {/* Basis badge */}
              <span className="text-xs text-gray-400 bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded shrink-0">
                {t.dryBasis
                  ? <Term tip="Checked against 100 g of the dry matter: the finished batch with its water taken out. Needs every ingredient’s moisture %.">per 100g dry</Term>
                  : t.basis === 'per_100g' || t.unit === PCT_OF_100G
                  ? <Term tip="Checked against 100 g of the finished product as is, after process losses.">per 100g</Term>
                  : (
                    <Term tip={t.servingSizeG
                      ? `Checked against one serving. ${t.servingSizeG} g is used when a formulation has no serving size of its own.`
                      : 'Checked against one serving, using each formulation’s serving size.'}
                    >
                      per serving{t.servingSizeG ? ` · ${t.servingSizeG}g` : ''}
                    </Term>
                  )}
              </span>

              {/* Actions */}
              {!readOnly && <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity">
                <button
                  onClick={() => setEditingIndex(i)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                  aria-label="Edit target"
                  data-tip="Edit this target"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  onClick={() => handleRemove(i)}
                  disabled={saveMutation.isPending}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-40"
                  aria-label="Remove target"
                  data-tip="Remove this target (asks first). Formulations stop being checked against it."
                >
                  <X size={13} />
                </button>
              </div>}
            </div>
          )
        )
      )}

      {/* Add form */}
      {readOnly ? null : addingNew ? (
        <TargetForm
          initial={EMPTY_TARGET()}
          nutrients={nutrients}
          saving={saveMutation.isPending}
          onSave={handleAdd}
          onCancel={() => setAddingNew(false)}
        />
      ) : (
        <button
          onClick={() => setAddingNew(true)}
          data-tip="Add a nutrition rule, e.g. protein at least 20 g per serving, that every formulation here is checked against"
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 transition-colors pt-1"
        >
          <Plus size={13} /> Add target
        </button>
      )}
    </div>
  )
}
