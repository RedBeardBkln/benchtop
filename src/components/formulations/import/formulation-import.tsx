'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, FileSpreadsheet, Loader2, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { readErrorMessage } from '@/lib/utils'
import { uploadStaged, UPLOAD_MAX_BYTES } from '@/lib/upload-file'
import type { ImportDraft } from '@/lib/formulation-import'
import { ImportReview } from './import-review'
import { IMPORTS_KEY, useImportDrafts } from './use-import-drafts'
import { Term } from '@/components/term'

/**
 * Import an existing formulation from an Excel or CSV file: upload, pick the formulation if the
 * file holds several, then review and fix it before it's saved (see ImportReview).
 */
export function FormulationImport({ projectId, draftId, canEditLibrary, canCreateProject }: {
  /** Opened from a project page: the import goes into that project unless the file names another */
  projectId: string | null
  /** Continue a saved draft */
  draftId: string | null
  canEditLibrary: boolean
  canCreateProject: boolean
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [reading, setReading] = useState<string | null>(null) // file name while reading
  const [found, setFound] = useState<ImportDraft[] | null>(null)
  const [review, setReview] = useState<{ draft: ImportDraft; importId: string | null } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const { data: drafts = [] } = useImportDrafts()

  // Continuing a saved draft from a link
  const { data: saved, error: savedError } = useQuery<{ id: string; draft: ImportDraft }>({
    queryKey: ['formulation-import', draftId],
    enabled: !!draftId,
    queryFn: async () => {
      const r = await fetch(`/api/formulation-imports/${draftId}`)
      if (!r.ok) throw new Error(await readErrorMessage(r, 'That import draft was not found'))
      return r.json()
    },
  })
  // Opened once per draft, so going back to the upload screen doesn't reopen it
  const openedRef = useRef<string | null>(null)
  useEffect(() => {
    if (saved && openedRef.current !== saved.id) {
      openedRef.current = saved.id
      setReview({ draft: saved.draft, importId: saved.id })
    }
  }, [saved])
  useEffect(() => {
    if (savedError) toast.error(savedError.message)
  }, [savedError])

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/formulation-imports/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not delete the draft'))
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: IMPORTS_KEY }); toast.success('Draft deleted') },
    onError: (e: Error) => toast.error(e.message),
  })

  function start(d: ImportDraft) {
    // Opened from a project: use it unless the file named a project that was found
    setReview({ draft: projectId && !d.project.id ? { ...d, project: { ...d.project, id: projectId } } : d, importId: null })
  }

  async function read(file: File) {
    if (file.size > UPLOAD_MAX_BYTES) { toast.error('File too large (max 20 MB)'); return }
    setReading(file.name)
    try {
      const stagedPath = await uploadStaged(file)
      const r = await fetch('/api/formulation-imports/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stagedPath }),
      })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not read that file'))
      const body = (await r.json()) as { drafts: ImportDraft[] }
      if (body.drafts.length === 1) start(body.drafts[0])
      else setFound(body.drafts)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not read that file')
    } finally {
      setReading(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function backToStart() {
    setReview(null)
    if (draftId) router.replace(projectId ? `/formulations/import?project=${projectId}` : '/formulations/import')
  }

  if (review) {
    return (
      <ImportReview
        key={review.importId ?? 'new'}
        initial={review.draft}
        importId={review.importId}
        canEditLibrary={canEditLibrary}
        canCreateProject={canCreateProject}
        onBack={found && found.length > 1 && !review.importId ? () => setReview(null) : backToStart}
      />
    )
  }

  return (
    <div className="px-4 py-5 sm:px-8 sm:py-8 max-w-3xl">
      <Link
        href={projectId ? `/projects/${projectId}` : '/projects'}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6"
      >
        <ArrowLeft size={14} /> {projectId ? 'Project' : 'Projects'}
      </Link>
      <h1 className="text-2xl font-semibold text-gray-900">Import a formulation</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">
        Upload a formulation you keep in Excel or a CSV file. benchtop reads it and builds a matching formulation for you
        to check. Nothing is saved until you say so.
      </p>

      {found && found.length > 1 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">This file has {found.length} formulations. Which one do you want to import?</h2>
          <p className="text-xs text-gray-500">You can come back to this list for the others.</p>
          <ul className="divide-y divide-gray-100">
            {found.map((d, i) => (
              <li key={i} className="py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{d.name || 'Untitled'}</div>
                  <div className="text-xs text-gray-500">
                    {d.sheet ? `Sheet “${d.sheet}” · ` : ''}{d.lines.length} ingredient{d.lines.length === 1 ? '' : 's'}
                  </div>
                </div>
                <button
                  onClick={() => start(d)}
                  data-tip="Opens this formulation for checking and fixing. Nothing is saved until you say so."
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Review
                </button>
              </li>
            ))}
          </ul>
          <button onClick={() => setFound(null)} className="text-sm text-gray-500 hover:text-gray-700">Upload a different file</button>
        </div>
      ) : (
        <label
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault()
            setDragOver(false)
            const f = e.dataTransfer.files?.[0]
            if (f && !reading) read(f)
          }}
          className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors
            ${reading ? 'cursor-wait border-gray-200 bg-gray-50' : 'cursor-pointer bg-white hover:border-blue-300'}
            ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}
        >
          {reading ? (
            <>
              <Loader2 size={28} className="text-blue-500 animate-spin" />
              <span className="text-sm font-medium text-gray-700">Reading {reading}…</span>
              <span className="text-xs text-gray-500">This can take up to a minute for a large workbook.</span>
            </>
          ) : (
            <>
              <Upload size={28} className="text-gray-300" />
              <span className="text-sm font-medium text-gray-700">Drop a file here, or click to choose one</span>
              <span className="text-xs text-gray-500">Excel (.xlsx) or CSV, up to 20 MB</span>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xlsm,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            disabled={!!reading}
            onChange={e => { const f = e.target.files?.[0]; if (f) read(f) }}
          />
        </label>
      )}

      {drafts.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Unfinished imports (<Term t="importDraft">drafts</Term>)</h2>
          <p className="text-xs text-gray-500 mb-3">
            Saved as drafts because something was still missing. They aren’t formulations yet; finish them to add them to your account.
          </p>
          <ul className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
            {drafts.map(d => (
              <li key={d.id} className="px-4 py-3 flex items-start gap-3">
                <FileSpreadsheet size={16} className="text-gray-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{d.name}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {d.fileName} · saved {formatDistanceToNow(new Date(d.updatedAt), { addSuffix: true })}
                  </div>
                  {d.missing.length > 0 && <div className="text-xs text-amber-700 mt-0.5">Missing: {d.missing.join('; ')}</div>}
                </div>
                <Link
                  href={`/formulations/import?draft=${d.id}${projectId ? `&project=${projectId}` : ''}`}
                  data-tip="Reopens this draft where you left off, so you can fill in what’s missing and finish it."
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-md hover:bg-gray-50 text-gray-700 shrink-0"
                >
                  Continue
                </Link>
                <button
                  onClick={() => { if (window.confirm(`Delete the import draft “${d.name}”?`)) remove.mutate(d.id) }}
                  aria-label={`Delete ${d.name}`}
                  data-tip="Deletes this unfinished import. Nothing else in your account is affected."
                  className="p-1.5 text-gray-400 hover:text-red-600 rounded shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
