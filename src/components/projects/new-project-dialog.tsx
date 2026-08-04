'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { X } from 'lucide-react'

export function NewProjectDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [client, setClient] = useState('')
  const [objectiveText, setObjectiveText] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), client: client.trim(), objectiveText: objectiveText.trim() }),
      }).then(async r => {
        const body = await r.json()
        if (!r.ok) throw new Error(body.error ?? 'Create failed')
        return body
      }),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success(`Project "${project.name}" created`)
      handleClose()
      router.push(`/projects/${project.id}`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function handleClose() {
    setName('')
    setClient('')
    setObjectiveText('')
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">New project</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <form
          className="px-6 py-5 space-y-4"
          onSubmit={e => { e.preventDefault(); if (name.trim()) mutation.mutate() }}
        >
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Project name <span className="text-red-400">*</span>
            </label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Plant Protein Shake v3"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Client / customer
              <span className="font-normal text-gray-400 ml-1">(optional)</span>
            </label>
            <input
              value={client}
              onChange={e => setClient(e.target.value)}
              placeholder="e.g. Alpine Bio Internal"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Objective
              <span className="font-normal text-gray-400 ml-1">(optional)</span>
            </label>
            <textarea
              value={objectiveText}
              onChange={e => setObjectiveText(e.target.value)}
              rows={3}
              placeholder="e.g. 30g protein per serving, clean label, nut-free"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md
                         focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || mutation.isPending}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md
                         hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {mutation.isPending ? 'Creating…' : 'Create project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
