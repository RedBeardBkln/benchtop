'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, Plus, FlaskConical, Lock, FileEdit, Target, Archive, RotateCcw, Edit2, Save, X } from 'lucide-react'
import type { Project, Formulation, ProjectTarget } from '@/lib/types'
import { ProjectTargets } from './project-targets'

type ProjectWithFormulations = Project & { formulations: Formulation[]; targets: ProjectTarget[] }

function NewFormulationDialog({
  projectId,
  open,
  onClose,
  onCreated,
}: {
  projectId: string
  open: boolean
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'ground_up' | 'reverse'>('ground_up')

  const mutation = useMutation({
    mutationFn: () =>
      fetch(`/api/projects/${projectId}/formulations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), mode }),
      }).then(async r => {
        const body = await r.json()
        if (!r.ok) throw new Error(body.error ?? 'Failed')
        return body
      }),
    onSuccess: (f) => {
      toast.success(`Formulation "${f.name}" created`)
      setName('')
      setMode('ground_up')
      onClose()
      onCreated(f.id)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
        <div className="px-5 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">New formulation</h3>
        </div>
        <form
          className="px-5 py-4 space-y-4"
          onSubmit={e => { e.preventDefault(); if (name.trim()) mutation.mutate() }}
        >
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Formula A — High Protein"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Mode</label>
            <select
              value={mode}
              onChange={e => setMode(e.target.value as 'ground_up' | 'reverse')}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ground_up">Ground up — build from ingredients</option>
              <option value="reverse">Reverse engineer — match a target label</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || mutation.isPending}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function ProjectDetail({ id }: { id: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameEdit, setNameEdit] = useState('')

  const { data, isLoading, error } = useQuery<ProjectWithFormulations>({
    queryKey: ['project', id],
    queryFn: () =>
      fetch(`/api/projects/${id}`).then(r => {
        if (!r.ok) throw new Error('Not found')
        return r.json()
      }),
  })

  const renameProjectMutation = useMutation({
    mutationFn: (name: string) =>
      fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      }).then(async r => { if (!r.ok) throw new Error('Failed'); return r.json() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setEditingName(false)
      toast.success('Project renamed')
    },
    onError: () => toast.error('Failed to rename project'),
  })

  const archiveMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: data?.status === 'active' ? 'archived' : 'active' }),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: () => toast.error('Failed to update project'),
  })

  const restoreFormulationMutation = useMutation({
    mutationFn: (formulationId: string) =>
      fetch(`/api/formulations/${formulationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: false }),
      }).then(async r => { if (!r.ok) throw new Error('Failed'); return r.json() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] })
      toast.success('Formulation restored')
    },
    onError: () => toast.error('Failed to restore formulation'),
  })

  if (isLoading) return <div className="px-8 py-8 text-sm text-gray-400">Loading…</div>
  if (error || !data) {
    return (
      <div className="px-8 py-8">
        <p className="text-sm text-red-500">Project not found.</p>
        <button onClick={() => router.back()} className="mt-2 text-sm text-blue-600 hover:underline">← Back</button>
      </div>
    )
  }

  return (
    <>
      <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-4xl">
        <button
          onClick={() => router.push('/projects')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6"
        >
          <ArrowLeft size={14} /> Projects
        </button>

        <div className="flex items-start justify-between mb-8">
          <div className="flex-1 min-w-0">
            {editingName ? (
              <form
                className="flex items-center gap-2 mb-1"
                onSubmit={e => {
                  e.preventDefault()
                  const v = nameEdit.trim()
                  if (v) renameProjectMutation.mutate(v)
                }}
              >
                <input
                  autoFocus
                  value={nameEdit}
                  onChange={e => setNameEdit(e.target.value)}
                  className="text-2xl font-semibold text-gray-900 border-b-2 border-blue-500 outline-none bg-transparent w-full"
                />
                <button type="submit" disabled={!nameEdit.trim() || renameProjectMutation.isPending}
                  className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 shrink-0">
                  <Save size={12} /> Save
                </button>
                <button type="button" onClick={() => setEditingName(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded shrink-0">
                  <X size={14} />
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2 group/name mb-0.5">
                <h1 className="text-2xl font-semibold text-gray-900">{data.name}</h1>
                <button
                  onClick={() => { setNameEdit(data.name); setEditingName(true) }}
                  className="opacity-0 group-hover/name:opacity-100 transition-opacity p-1 text-gray-400 hover:text-gray-700 rounded"
                  title="Rename project"
                >
                  <Edit2 size={14} />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              {data.client && <span className="text-sm text-gray-500">{data.client}</span>}
              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                data.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {data.status}
              </span>
            </div>
            {data.objectiveText && (
              <p className="mt-2 text-sm text-gray-500 max-w-xl">{data.objectiveText}</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => archiveMutation.mutate()}
              disabled={archiveMutation.isPending}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50 text-gray-600 transition-colors"
            >
              {data.status === 'active' ? 'Archive' : 'Restore'}
            </button>
          </div>
        </div>

        {/* Formulations section */}
        {(() => {
          const active = data.formulations.filter(f => !f.archivedAt)
          const archived = data.formulations.filter(f => !!f.archivedAt)
          return (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-700">Formulations</h2>
                <div className="flex items-center gap-2">
                  {archived.length > 0 && (
                    <button
                      onClick={() => setShowArchived(v => !v)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-gray-200 rounded-md text-gray-500 hover:bg-gray-50 transition-colors"
                    >
                      <Archive size={12} />
                      {showArchived ? 'Hide archived' : `Archived (${archived.length})`}
                    </button>
                  )}
                  <button
                    onClick={() => setDialogOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <Plus size={14} /> New formulation
                  </button>
                </div>
              </div>

              {active.length === 0 && !showArchived ? (
                <div className="rounded-lg border border-dashed border-gray-200 bg-white p-10 text-center">
                  <FlaskConical size={28} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-400">No formulations yet.</p>
                  <button onClick={() => setDialogOpen(true)} className="mt-2 text-sm text-blue-600 hover:underline">
                    Create first formulation →
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Name</th>
                        <th className="px-4 py-3 text-left font-medium">Mode</th>
                        <th className="px-4 py-3 text-left font-medium">Version</th>
                        <th className="px-4 py-3 text-left font-medium">Status</th>
                        <th className="px-4 py-3 text-left font-medium">Updated</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {active.map(f => (
                        <tr
                          key={f.id}
                          onClick={() => router.push(`/formulations/${f.id}`)}
                          className="hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3 font-medium text-gray-900">
                            <div className="flex items-center gap-2">
                              {f.status === 'locked'
                                ? <Lock size={12} className="text-gray-400 shrink-0" />
                                : <FileEdit size={12} className="text-blue-400 shrink-0" />
                              }
                              {f.name}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-500">{f.mode === 'ground_up' ? 'Ground up' : 'Reverse'}</td>
                          <td className="px-4 py-3 text-gray-500">v{f.version}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                              f.status === 'locked' ? 'bg-gray-100 text-gray-600' : 'bg-blue-50 text-blue-600'
                            }`}>{f.status}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-400 tabular-nums">{new Date(f.updatedAt).toLocaleDateString()}</td>
                          <td className="px-4 py-3" />
                        </tr>
                      ))}
                      {showArchived && archived.map(f => (
                        <tr key={f.id} className="bg-gray-50/60 opacity-60">
                          <td className="px-4 py-3 font-medium text-gray-500">
                            <div className="flex items-center gap-2">
                              <Archive size={12} className="text-gray-400 shrink-0" />
                              {f.name}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-400">{f.mode === 'ground_up' ? 'Ground up' : 'Reverse'}</td>
                          <td className="px-4 py-3 text-gray-400">v{f.version}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-400">archived</span>
                          </td>
                          <td className="px-4 py-3 text-gray-400 tabular-nums">{new Date(f.updatedAt).toLocaleDateString()}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={e => { e.stopPropagation(); restoreFormulationMutation.mutate(f.id) }}
                              className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-200 rounded hover:bg-white text-gray-500 transition-colors"
                            >
                              <RotateCcw size={11} /> Restore
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}
            </>
          )
        })()}
        {/* Nutritional targets */}
        <div className="mt-10">
          <div className="flex items-center gap-2 mb-4">
            <Target size={15} className="text-gray-400" />
            <h2 className="text-base font-semibold text-gray-700">Nutritional targets</h2>
            <span className="text-xs text-gray-400 font-normal">
              — validates every formulation in this project
            </span>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 px-5 py-4">
            <ProjectTargets
              projectId={id}
              initialTargets={(data.targets ?? []) as ProjectTarget[]}
            />
          </div>
        </div>
      </div>

      <NewFormulationDialog
        projectId={id}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={(fId) => router.push(`/formulations/${fId}`)}
      />
    </>
  )
}
