'use client'

import { useState } from 'react'
import { Download, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { btnPrimary, btnSecondary } from './ui'
import {
  DEFAULT_CHOICES, EXPORT_CATEGORIES, FORMAT_LABEL, exportsAnything,
  type AnyFormat, type ExportCategory, type ExportChoices, type PanelFormat, type PanelJob,
} from '@/lib/export/model'

const CATEGORY_KEYS = Object.keys(EXPORT_CATEGORIES) as ExportCategory[]

type ExportResponse = {
  url: string
  path: string
  fileName: string
  root: string
  panels: { format: PanelFormat; jobs: PanelJob[] }
}

/** Save a file the browser already has in memory */
function saveBlob(blob: Blob, fileName: string) {
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(href), 60_000)
}

/**
 * Draw each Nutrition Facts panel with the editor's own panel code and add it to the zip the server built.
 * The server can't draw them: the panel is made with the browser's canvas.
 */
async function addPanels(zipBlob: Blob, root: string, format: PanelFormat, jobs: PanelJob[], onProgress: (done: number) => void): Promise<Blob> {
  const [{ default: JSZip }, { drawNfpToCanvas }, { nfpCanvasToBlob }] = await Promise.all([
    import('jszip'), import('@/components/formulations/nfp-canvas'), import('@/components/formulations/nfp-export'),
  ])
  const zip = await JSZip.loadAsync(zipBlob)
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i]
    const canvas = drawNfpToCanvas({ model: job.model })
    // Images and PDFs are already compressed
    zip.file(`${root}/${job.path}`, await nfpCanvasToBlob(canvas, format), { compression: 'STORE' })
    onProgress(i + 1)
    // Let the dialog repaint between panels
    await new Promise(r => setTimeout(r, 0))
  }
  // STORE: re-deflating would recompress every entry (JSZip doesn't reuse their compressed data), ~10x slower. The big
  // entries (spreadsheets and Word files are zips themselves, PDFs, images) are compressed already.
  return zip.generateAsync({ type: 'blob', compression: 'STORE' })
}

// Render only while open, so the choices reset to the defaults on every open
export function ExportDataDialog({ onClose }: { onClose: () => void }) {
  const [choices, setChoices] = useState<ExportChoices>(DEFAULT_CHOICES)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const busy = status !== null
  const isDefault = CATEGORY_KEYS.every(k => choices[k] === DEFAULT_CHOICES[k])
  const nothingChosen = !exportsAnything(choices)

  const choose = (key: ExportCategory, format: AnyFormat) => setChoices(prev => ({ ...prev, [key]: format }))

  async function run() {
    setStatus('Preparing your export. This can take a minute.')
    setError(null)
    try {
      const r = await fetch('/api/account/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ choices, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(typeof data.error === 'string' ? data.error : 'The export failed. Try again.')
      const { url, path, fileName, root, panels } = data as ExportResponse

      setStatus('Downloading…')
      const file = await fetch(url).catch(() => null)
      if (!file?.ok) {
        // Can't read it from here, so the panels can't be added: let the browser download it directly
        // (the staged copy is cleared after an hour)
        window.location.assign(url)
        if (panels.jobs.length) toast.warning('Your export is downloading without the Nutrition Facts panels. Try again to include them.')
        else toast.success('Your export is downloading')
        onClose()
        return
      }
      let zip = await file.blob()
      if (panels.jobs.length) {
        const total = panels.jobs.length
        setStatus(`Adding Nutrition Facts panels (0 of ${total})…`)
        zip = await addPanels(zip, root, panels.format, panels.jobs, done => setStatus(`Adding Nutrition Facts panels (${done} of ${total})…`))
      }
      saveBlob(zip, fileName)
      // Got it: remove the staged copy
      void fetch(`/api/account/export?path=${encodeURIComponent(path)}`, { method: 'DELETE' }).catch(() => {})
      toast.success('Your export is downloading')
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The export failed. Try again.')
      setStatus(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={busy ? undefined : onClose}>
      <form
        className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
        onSubmit={e => { e.preventDefault(); if (!busy && !nothingChosen) void run() }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Export all data</h3>
            <p className="text-sm text-gray-500 mt-0.5">Download everything in this account as one zip file. Choose a format for each part, or skip it.</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close"
            className="p-1 -m-1 text-gray-400 hover:text-gray-600 disabled:opacity-40">
            <X size={16} />
          </button>
        </div>

        <fieldset className="divide-y divide-gray-100 border border-gray-200 rounded-lg" disabled={busy}>
          <legend className="sr-only">Formats</legend>
          {CATEGORY_KEYS.map(key => {
            const cat = EXPORT_CATEGORIES[key]
            const selected = choices[key] as AnyFormat
            const hints = cat.hint as Partial<Record<AnyFormat, string>>
            return (
              <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-800">{cat.label}</div>
                  <div className="text-xs text-gray-500">{hints[selected]}</div>
                </div>
                <div role="radiogroup" aria-label={`${cat.label} format`} className="inline-flex shrink-0 self-start sm:self-auto rounded-md border border-gray-200 p-0.5 bg-gray-50">
                  {(cat.options as readonly AnyFormat[]).map((format, i) => {
                    const on = selected === format
                    return (
                      <label key={format}
                        className={`px-2.5 py-1 text-xs rounded cursor-pointer transition-colors ${
                          on ? (format === 'skip' ? 'bg-white text-gray-700 font-medium shadow-sm ring-1 ring-gray-400' : 'bg-white text-blue-700 font-medium shadow-sm ring-1 ring-blue-500') : 'text-gray-600 hover:text-gray-900'
                        }`}
                        title={i === 0 ? 'Default' : undefined}
                      >
                        <input type="radio" name={`export-${key}`} value={format} checked={on}
                          onChange={() => choose(key, format)} className="sr-only" />
                        {FORMAT_LABEL[format]}
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </fieldset>

        <p className="text-xs text-gray-500">A README in the zip lists everything inside, and anything you skipped.</p>

        {nothingChosen && <p className="text-sm text-gray-600">Every part is skipped. Choose at least one to export.</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-1">
          {status && <span className="text-xs text-gray-500 mr-auto" aria-live="polite">{status}</span>}
          {!busy && !isDefault && (
            <button type="button" onClick={() => setChoices(DEFAULT_CHOICES)} className="text-xs text-gray-500 hover:text-gray-700 mr-auto">
              Reset to defaults
            </button>
          )}
          <button type="button" onClick={onClose} disabled={busy} className={btnSecondary}>
            Cancel
          </button>
          <button type="submit" disabled={busy || nothingChosen} className={`${btnPrimary} gap-1.5`}
            data-tip="Builds the zip with the formats chosen above and downloads it">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {busy ? 'Exporting…' : 'Export'}
          </button>
        </div>
      </form>
    </div>
  )
}
