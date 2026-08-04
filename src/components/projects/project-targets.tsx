'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react'
import type { Nutrient, ProjectTarget } from '@/lib/types'

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

function fmtTarget(t: ProjectTarget): string {
  const v = `${t.value} ${t.unit}`
  if (t.comparator === 'range') return `${t.value} – ${t.valueMax ?? '?'} ${t.unit}`
  if (t.comparator === '>=') return `≥ ${v}`
  if (t.comparator === '<=') return `≤ ${v}`
  return `= ${v}`
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

  function handleNutrientChange(name: string) {
    const n = nutrients?.find(n => n.name === name)
    setDraft(d => ({ ...d, nutrient: name || null, label: name || d.label, unit: n?.unit ?? d.unit }))
  }

  const canSave = !!(draft.nutrient || draft.label.trim()) && draft.value > 0

  return (
    <div className="border border-blue-100 rounded-lg p-3 bg-blue-50/30 space-y-3">
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center">
        {/* Nutrient */}
        <select
          value={draft.nutrient ?? ''}
          onChange={e => handleNutrientChange(e.target.value)}
          className="px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
        >
          <option value="">— select nutrient —</option>
          {nutrients?.map(n => <option key={n.id} value={n.name}>{n.name}</option>)}
        </select>

        {/* Comparator */}
        <select
          value={draft.comparator}
          onChange={e => setDraft(d => ({ ...d, comparator: e.target.value as ProjectTarget['comparator'] }))}
          className="px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
        >
          {Object.entries(COMPARATOR_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        {/* Value */}
        <input
          type="number" min="0" step="any"
          value={draft.value || ''}
          onChange={e => setDraft(d => ({ ...d, value: parseFloat(e.target.value) || 0 }))}
          placeholder={draft.comparator === 'range' ? 'min' : 'value'}
          className="w-20 px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 tabular-nums bg-white"
        />

        {/* ValueMax or unit label */}
        {draft.comparator === 'range' ? (
          <input
            type="number" min="0" step="any"
            value={draft.valueMax ?? ''}
            onChange={e => setDraft(d => ({ ...d, valueMax: parseFloat(e.target.value) || undefined }))}
            placeholder="max"
            className="w-20 px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 tabular-nums bg-white"
          />
        ) : (
          <span className="text-xs text-gray-400 w-20 text-center">{draft.unit}</span>
        )}

        {/* Basis */}
        <select
          value={draft.basis}
          onChange={e => setDraft(d => ({
            ...d,
            basis: e.target.value as ProjectTarget['basis'],
            servingSizeG: e.target.value === 'per_100g' ? undefined : d.servingSizeG,
          }))}
          className="px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
        >
          <option value="per_100g">per 100g</option>
          <option value="per_serving">per serving</option>
        </select>
      </div>

      {/* Serving size — only when per_serving selected */}
      {draft.basis === 'per_serving' && (
        <div className="flex items-center gap-2 pl-1">
          <span className="text-xs text-gray-500 shrink-0">Serving size:</span>
          <input
            type="number" min="0.1" step="any"
            value={draft.servingSizeG ?? ''}
            onChange={e => setDraft(d => ({ ...d, servingSizeG: parseFloat(e.target.value) || undefined }))}
            placeholder="e.g. 240"
            className="w-24 px-2 py-1.5 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 tabular-nums bg-white"
          />
          <span className="text-xs text-gray-400">g</span>
          {!draft.servingSizeG && (
            <span className="text-xs text-amber-500">← enter serving size in grams</span>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={() => onSave(draft)}
          disabled={!canSave || saving}
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
}: {
  projectId: string
  initialTargets: ProjectTarget[]
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
                {t.basis === 'per_100g'
                  ? 'per 100g'
                  : `per serving${t.servingSizeG ? ` · ${t.servingSizeG}g` : ''}`}
              </span>

              {/* Actions */}
              <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity">
                <button
                  onClick={() => setEditingIndex(i)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                  title="Edit"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  onClick={() => handleRemove(i)}
                  disabled={saveMutation.isPending}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-40"
                  title="Remove"
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          )
        )
      )}

      {/* Add form */}
      {addingNew ? (
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
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 transition-colors pt-1"
        >
          <Plus size={13} /> Add target
        </button>
      )}
    </div>
  )
}
