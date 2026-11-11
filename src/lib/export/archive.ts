import JSZip from 'jszip'
import type { ExportData } from './data'
import { assignDocPaths, buildExportFiles, buildReadme, panelJobs, type Clock } from './build'
import type { ExportChoices, PanelJob } from './model'

const BRAND = 'Benchtop'

/**
 * Most the staged zip may hold. Storage rejects a single file over its upload limit (50 MB by default), so
 * uploaded documents that would take the zip past this are left out and listed in the README instead of
 * failing the whole export. The data files always go in.
 */
export const STAGED_ZIP_BUDGET_BYTES = 45 * 1024 * 1024

/**
 * Build the export as one zip: each category in its chosen format, the original uploaded ingredient
 * documents, and a README. Nutrition Facts panels are not in it yet: they're returned as `panels` for the
 * browser to draw and add under `root`. `fetchDoc` returns a stored file's bytes, or null if it can't be read.
 */
export async function buildExportArchive(opts: {
  data: ExportData
  choices: ExportChoices
  clock: Clock
  /** e.g. "2026-11-11", used in the zip and folder name */
  dateStamp: string
  fetchDoc: (filePath: string) => Promise<Uint8Array | null>
  budgetBytes?: number
}): Promise<{ fileName: string; root: string; bytes: Buffer; panels: PanelJob[] }> {
  const { data, choices, clock, dateStamp, fetchDoc, budgetBytes = STAGED_ZIP_BUDGET_BYTES } = opts
  const root = `${BRAND} export ${dateStamp}`
  const zip = new JSZip()
  const folder = zip.folder(root)!
  const docPaths = assignDocPaths(data.ingredients)
  let used = 0
  const add = (path: string, bytes: Uint8Array, store = false) => {
    used += bytes.length
    folder.file(path, bytes, store ? { compression: 'STORE' } : undefined)
  }

  // Rendered one at a time to keep memory flat; renderers load only when a file needs them
  for (const file of buildExportFiles(data, clock, docPaths, choices)) {
    if (file.kind === 'workbook') {
      const { renderWorkbook } = await import('./render-xlsx')
      add(`${file.book.path}.xlsx`, await renderWorkbook(file.book))
    } else if (file.format === 'docx') {
      const { renderDocx } = await import('./render-docx')
      add(`${file.report.path}.docx`, await renderDocx(file.report))
    } else {
      const { renderPdf } = await import('./render-pdf')
      add(`${file.report.path}.pdf`, await renderPdf(file.report))
    }
  }

  // Stored files are fetched one at a time too
  const missing: string[] = []
  const leftOut: string[] = []
  for (const ingredient of data.ingredients) {
    for (const doc of ingredient.docs) {
      const label = `${ingredient.name}: ${doc.label}`
      const bytes = await fetchDoc(doc.filePath).catch(() => null)
      if (!bytes) missing.push(label)
      else if (used + bytes.length > budgetBytes) leftOut.push(label)
      else add(docPaths.get(doc.id)!, bytes, true)
    }
  }

  const panels = panelJobs(data, choices.nfp)
  folder.file('README.txt', buildReadme({ data, clock, choices, panels: panels.length, missingDocs: missing, leftOutDocs: leftOut }))

  const bytes = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  return { fileName: `${root}.zip`, root, bytes, panels }
}
