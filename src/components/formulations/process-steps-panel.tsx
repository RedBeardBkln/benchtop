'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { GripVertical, Plus, X, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import type { ProcessStep } from '@/lib/types'

type StepParams = {
  temp_c?: string
  time_min?: string
  ph?: string
  solids_pct?: string
  shear?: string
  pressure?: string
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
  steps: ProcessStep[]
  isLocked: boolean
}) {
  const queryClient = useQueryClient()
  const [ordered, setOrdered] = useState(steps)
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [newInstruction, setNewInstruction] = useState('')

  useEffect(() => {
    setOrdered(steps)
  }, [steps])

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['formulation', formulationId] })
  }

  const addMutation = useMutation({
    mutationFn: (instruction: string) =>
      fetch(`/api/formulations/${formulationId}/process-steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction }),
      }).then(jsonOrThrow),
    onSuccess: () => {
      setNewInstruction('')
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
    addMutation.mutate(instruction)
  }

  function updateParam(step: ProcessStep, key: keyof StepParams, value: string) {
    const currentParams = (step.params ?? {}) as StepParams
    const nextParams = { ...currentParams }
    if (value.trim()) nextParams[key] = value.trim()
    else delete nextParams[key]
    patchMutation.mutate({ stepId: step.id, body: { params: nextParams } })
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
                draggable={!isLocked}
                onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDragKey(step.id) }}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverKey(step.id) }}
                onDrop={(e) => { e.preventDefault(); if (dragKey) reorder(dragKey, step.id); setDragOverKey(null) }}
                onDragEnd={() => { setDragKey(null); setDragOverKey(null) }}
                className={`transition-colors ${
                  isBeingDragged ? 'opacity-40 bg-blue-50' :
                  isDropTarget ? 'border-t-2 border-blue-400 bg-blue-50/40' :
                  'bg-white'
                }`}
              >
                <div className="flex items-start gap-2 px-3 py-2.5">
                  <div className={`pt-1 ${!isLocked ? 'cursor-grab active:cursor-grabbing' : ''}`}>
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

                    {isExpanded && (
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1 pb-1">
                        {([
                          ['temp_c', 'Temp (°C)'],
                          ['time_min', 'Time (min)'],
                          ['ph', 'pH'],
                          ['solids_pct', 'Solids (%)'],
                          ['shear', 'Shear'],
                          ['pressure', 'Pressure'],
                        ] as const).map(([key, label]) => (
                          <div key={key} className="space-y-0.5">
                            <label className="text-[10px] text-gray-400">{label}</label>
                            <input
                              defaultValue={p[key] ?? ''}
                              disabled={isLocked}
                              onBlur={(e) => updateParam(step, key, e.target.value)}
                              className="w-full px-1.5 py-1 text-xs border border-gray-200 rounded
                                         focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        ))}
                        <div className="col-span-3 sm:col-span-6 space-y-0.5">
                          <label className="text-[10px] text-gray-400">Yield loss (%)</label>
                          <input
                            defaultValue={step.lossPct ?? ''}
                            disabled={isLocked}
                            type="number"
                            min="0"
                            max="100"
                            step="any"
                            onBlur={(e) => {
                              const raw = e.target.value.trim()
                              const value = raw ? parseFloat(raw) : null
                              const current = step.lossPct != null ? parseFloat(step.lossPct) : null
                              if (value !== current) {
                                patchMutation.mutate({ stepId: step.id, body: { lossPct: value } })
                              }
                            }}
                            className="w-24 px-1.5 py-1 text-xs border border-gray-200 rounded
                                       focus:outline-none focus:ring-2 focus:ring-blue-500 tabular-nums"
                          />
                        </div>
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
        <div className="flex items-center gap-2">
          <input
            value={newInstruction}
            onChange={(e) => setNewInstruction(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
            placeholder="Add a process step, e.g. Heat to 85°C for 10 minutes"
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
      )}
    </div>
  )
}
