import JSZip from 'jszip'
import type { ExportData } from './data'
import { assignDocPaths, buildExportFiles, buildReadme, panelJobs, type Clock } from './build'
import type { ExportChoices, ExportFile, PanelJob } from './model'

/** What went into an export, for the export log */
export type ExportSummary = Record<string, number>

const BRAND = 'Benchtop'

/**
 * Most the staged zip may hold. Storage rejects a single file over its upload limit (50 MB by default), so
 * uploaded documents that would take the zip past this are left out and listed in the README instead of
 * failing the whole export. The data files always go in.
 */
export const STAGED_ZIP_BUDGET_BYTES = 45 * 1024 * 1024

// The Suppliers and ingredients file lists the documents, so it's built after they're chosen; room kept for it
const DOCS_LIST_PATH = 'Suppliers and ingredients'
const DOCS_LIST_RESERVE_BYTES = 3 * 1024 * 1024

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
}): Promise<{ fileName: string; root: string; bytes: Buffer; panels: PanelJob[]; summary: ExportSummary }> {
  const { data, choices, clock, dateStamp, fetchDoc, budgetBytes = STAGED_ZIP_BUDGET_BYTES } = opts
  const root = `${BRAND} export ${dateStamp}`
  const zip = new JSZip()
  const folder = zip.folder(root)!
  const withDocs = choices.documents !== 'skip'
  // Where each document would go; only the ones that make it into the zip keep their path (see below)
  const allDocPaths = withDocs ? assignDocPaths(data.ingredients) : new Map<string, string>()
  let dataFiles = 0
  let used = 0
  const add = (path: string, bytes: Uint8Array, store = false) => {
    used += bytes.length
    if (!store) dataFiles++
    folder.file(path, bytes, store ? { compression: 'STORE' } : undefined)
  }
  const render = async (file: ExportFile) => {
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
  // The one file that lists the documents, built last so it only points at the ones actually included
  const listsDocs = (file: ExportFile) => (file.kind === 'workbook' ? file.book.path : file.report.path) === DOCS_LIST_PATH

  // Rendered one at a time to keep memory flat; renderers load only when a file needs them
  for (const file of buildExportFiles(data, clock, allDocPaths, choices)) {
    if (!listsDocs(file)) await render(file)
  }

  // Stored files are fetched one at a time too, leaving room for the documents list still to come
  const missing: string[] = []
  const leftOut: string[] = []
  const docPaths = new Map<string, string>()
  for (const ingredient of withDocs ? data.ingredients : []) {
    for (const doc of ingredient.docs) {
      const label = `${ingredient.name}: ${doc.label}`
      const bytes = await fetchDoc(doc.filePath).catch(() => null)
      if (!bytes) missing.push(label)
      else if (used + bytes.length + DOCS_LIST_RESERVE_BYTES > budgetBytes) leftOut.push(label)
      else {
        const path = allDocPaths.get(doc.id)!
        add(path, bytes, true)
        docPaths.set(doc.id, path)
      }
    }
  }
  const docs = docPaths.size
  for (const file of buildExportFiles(data, clock, docPaths, choices)) {
    if (listsDocs(file)) await render(file)
  }

  const panels = choices.nfp === 'skip' ? [] : panelJobs(data, choices.nfp)
  folder.file('README.txt', buildReadme({ data, clock, choices, panels: panels.length, missingDocs: missing, leftOutDocs: leftOut }))

  const bytes = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  const summary: ExportSummary = {
    dataFiles, panels: panels.length, documents: docs, documentsLeftOut: leftOut.length, documentsUnreadable: missing.length,
    projects: data.projects.length, formulations: data.formulations.length, ingredients: data.ingredients.length,
    conversations: data.conversations.length,
  }
  return { fileName: `${root}.zip`, root, bytes, panels, summary }
}
