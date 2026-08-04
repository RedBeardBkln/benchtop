'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Plus, FolderOpen } from 'lucide-react'
import type { ProjectSummary } from '@/lib/types'
import { NewProjectDialog } from './new-project-dialog'

export function ProjectList() {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data: projects, isLoading } = useQuery<ProjectSummary[]>({
    queryKey: ['projects'],
    queryFn: () => fetch('/api/projects').then(r => r.json()),
  })

  return (
    <>
      <div className="px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Projects</h1>
            <p className="text-sm text-gray-500 mt-1">Formulation projects</p>
          </div>
          <button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm
                       font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus size={15} /> New project
          </button>
        </div>

        {isLoading ? (
          <div className="text-sm text-gray-400">Loading…</div>
        ) : !projects?.length ? (
          <div className="rounded-lg border border-dashed border-gray-200 bg-white p-12 text-center">
            <FolderOpen size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-400">No projects yet.</p>
            <button
              onClick={() => setDialogOpen(true)}
              className="mt-3 text-sm text-blue-600 hover:underline"
            >
              Create your first project →
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Project</th>
                  <th className="px-4 py-3 text-left font-medium">Client</th>
                  <th className="px-4 py-3 text-left font-medium">Formulations</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {projects.map(p => (
                  <tr
                    key={p.id}
                    onClick={() => router.push(`/projects/${p.id}`)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3 text-gray-500">{p.client ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{p.formulationCount}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        p.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 tabular-nums">
                      {new Date(p.updatedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <NewProjectDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  )
}
