// Importing an existing formulation from a spreadsheet: the editable draft the review screen works
// on, matching sheet names to the library, unit conversion, and what is still missing.
// Pure (no DB or AI imports) so the client, the API and the tests share it.

import { z } from 'zod'
import { KG_PER_UNIT } from './costing'

export const IMPORT_UNITS = ['g', 'kg', 'mg', 'lb', 'oz', '%'] as const
export type ImportUnit = (typeof IMPORT_UNITS)[number]

const GRAMS_PER_UNIT: Record<Exclude<ImportUnit, '%'>, number> = {
  g: 1,
  kg: KG_PER_UNIT.kg * 1000,
  mg: 0.001,
  lb: KG_PER_UNIT.lb * 1000,
  oz: KG_PER_UNIT.oz * 1000,
}

// open     = needs a decision (no match, or a suggestion not yet accepted)
// matched  = linked to a library ingredient
// skipped  = left for later; the import can only be saved as a draft
// excluded = not part of the formula (a total row, a note); dropped on save
export const LINE_STATUSES = ['open', 'matched', 'skipped', 'excluded'] as const
export type LineStatus = (typeof LINE_STATUSES)[number]

const nameRef = z.object({ id: z.string().uuid(), name: z.string() })

export const importLineSchema = z.object({
  key: z.string().min(1).max(64),
  rawName: z.string().max(500),
  // The quantity as written in the file, shown next to the parsed one
  rawQuantity: z.string().max(200),
  amount: z.number().min(0).nullable(),
  unit: z.enum(IMPORT_UNITS).nullable(),
  supplier: z.string().max(255).nullable(),
  itemCode: z.string().max(100).nullable(),
  note: z.string().max(1000).nullable(),
  ingredientId: z.string().uuid().nullable(),
  ingredientName: z.string().max(500).nullable(),
  candidates: z.array(nameRef).max(5),
  status: z.enum(LINE_STATUSES),
})
export type ImportLine = z.infer<typeof importLineSchema>

export const importStepSchema = z.object({
  key: z.string().min(1).max(64),
  instruction: z.string().max(2000),
  included: z.boolean(),
})
export type ImportStep = z.infer<typeof importStepSchema>

// Client and project as named in the file, and what the user picked (null = not chosen yet)
const linkSchema = z.object({
  rawName: z.string().max(255).nullable(),
  id: z.string().uuid().nullable(),
  skipped: z.boolean(),
})

export const importDraftSchema = z.object({
  fileName: z.string().max(255),
  sheet: z.string().max(255).nullable(),
  name: z.string().max(255),
  servingSizeG: z.number().positive().nullable(),
  batchSizeG: z.number().positive().nullable(),
  notes: z.string().max(5000).nullable(),
  client: linkSchema,
  project: linkSchema,
  lines: z.array(importLineSchema).max(300),
  steps: z.array(importStepSchema).max(100),
  // Things the reader noticed in the file (assumptions, unreadable rows)
  warnings: z.array(z.string().max(500)).max(50),
})
export type ImportDraft = z.infer<typeof importDraftSchema>

// ── Matching ────────────────────────────────────────────────────────────────────────────────

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9%.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const tokens = (s: string) => new Set(normalizeName(s).split(' ').filter(t => t.length > 1))

/** 1 for the same name, otherwise how many words the two share (0–1) */
export function nameScore(a: string, b: string): number {
  const na = normalizeName(a), nb = normalizeName(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  const ta = tokens(a), tb = tokens(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let shared = 0
  for (const t of ta) if (tb.has(t)) shared++
  const jaccard = shared / (ta.size + tb.size - shared)
  // "Whey Protein Isolate" vs "Whey Protein Isolate 90 (Brand X)": every word of one is in the other
  const contained = shared === Math.min(ta.size, tb.size) ? 0.75 : 0
  return Math.max(jaccard, contained)
}

export type LibraryIngredient = {
  id: string
  name: string
  labelName?: string | null
  itemCode?: string | null
  supplierName?: string | null
}

const SUGGEST_MIN = 0.4

/**
 * Match one sheet row to the library. A same-name (or same item code) ingredient is linked
 * straight away; anything looser is only suggested, for the user to confirm.
 */
export function matchIngredient(
  row: { name: string; itemCode?: string | null; supplier?: string | null },
  library: LibraryIngredient[],
): { ingredient: LibraryIngredient | null; candidates: LibraryIngredient[] } {
  const code = row.itemCode?.trim().toLowerCase()
  if (code) {
    const byCode = library.filter(i => i.itemCode?.trim().toLowerCase() === code)
    // One item code can be reused across suppliers; only trust it when it's unambiguous
    const exact = byCode.length === 1 ? byCode[0]
      : byCode.find(i => row.supplier && normalizeName(i.supplierName ?? '') === normalizeName(row.supplier))
    if (exact) return { ingredient: exact, candidates: [] }
  }
  const scored = library
    .map(i => ({ i, s: Math.max(nameScore(row.name, i.name), i.labelName ? nameScore(row.name, i.labelName) : 0) }))
    .filter(x => x.s >= SUGGEST_MIN)
    .sort((a, b) => b.s - a.s || a.i.name.localeCompare(b.i.name))
  const exact = scored.filter(x => x.s === 1)
  if (exact.length === 1) return { ingredient: exact[0].i, candidates: [] }
  return { ingredient: null, candidates: scored.slice(0, 5).map(x => x.i) }
}

/** The one record whose name matches exactly (ignoring case and punctuation), if any */
export function matchByName<T extends { id: string; name: string }>(name: string | null, rows: T[]): T | null {
  if (!name?.trim()) return null
  const n = normalizeName(name)
  const hits = rows.filter(r => normalizeName(r.name) === n)
  return hits.length === 1 ? hits[0] : null
}

// ── Quantities ──────────────────────────────────────────────────────────────────────────────

/** A line's grams in the batch, or null when it can't be worked out yet */
export function lineGrams(line: Pick<ImportLine, 'amount' | 'unit'>, batchSizeG: number | null): number | null {
  if (line.amount == null || line.amount <= 0 || !line.unit) return null
  if (line.unit === '%') return batchSizeG && batchSizeG > 0 ? (line.amount / 100) * batchSizeG : null
  return line.amount * GRAMS_PER_UNIT[line.unit]
}

export const includedLines = (d: Pick<ImportDraft, 'lines'>) => d.lines.filter(l => l.status !== 'excluded')

/** Sum of the % lines, when the formula is written in percentages (for a "doesn't add up" hint) */
export function percentTotal(d: Pick<ImportDraft, 'lines'>): number | null {
  const pct = includedLines(d).filter(l => l.unit === '%' && l.amount != null)
  return pct.length ? pct.reduce((s, l) => s + (l.amount ?? 0), 0) : null
}

// ── What's missing ──────────────────────────────────────────────────────────────────────────

export type Missing = {
  /** Without these the import can only be saved as a draft */
  vital: string[]
  /** Fine to leave out; the formulation saves without them */
  optional: string[]
}

export function missingInfo(d: ImportDraft): Missing {
  const vital: string[] = []
  const optional: string[] = []
  const lines = includedLines(d)

  if (!d.name.trim()) vital.push('Formulation name')
  if (!d.project.id) vital.push(d.project.skipped ? 'Project (skipped)' : 'Project')
  if (lines.length === 0) vital.push('At least one ingredient')

  const unmatched = lines.filter(l => l.status !== 'matched' || !l.ingredientId)
  if (unmatched.length) {
    const skipped = unmatched.filter(l => l.status === 'skipped').length
    vital.push(
      `${unmatched.length} ingredient${unmatched.length === 1 ? '' : 's'} not linked to your library` +
      (skipped ? ` (${skipped} skipped)` : ''),
    )
  }
  const needsBatch = lines.some(l => l.unit === '%') && !d.batchSizeG
  if (needsBatch) vital.push('Batch size (needed to turn percentages into grams)')
  const noQty = lines.filter(l => !(l.amount != null && l.amount > 0 && l.unit))
  if (noQty.length) vital.push(`${noQty.length} ingredient${noQty.length === 1 ? '' : 's'} without a usable amount`)

  // The client only matters for a new project; an existing project already has its own
  if (!d.project.id && !d.client.id && d.client.rawName && !d.client.skipped) optional.push(`Client “${d.client.rawName}”`)
  if (!d.servingSizeG) optional.push('Serving size')
  const pct = percentTotal(d)
  if (pct != null && Math.abs(pct - 100) > 0.5 && lines.every(l => l.unit === '%')) {
    optional.push(`Percentages add up to ${Math.round(pct * 100) / 100}%, not 100%`)
  }
  return { vital, optional }
}

/**
 * The formula lines to save: grams per ingredient, with an ingredient that appears on several
 * rows combined into one line (a formulation lists each ingredient once). Null if anything vital
 * is missing.
 */
export function linesToSave(d: ImportDraft): Array<{ ingredientId: string; weightG: number }> | null {
  if (missingInfo(d).vital.length) return null
  const byId = new Map<string, number>()
  for (const l of includedLines(d)) {
    const g = lineGrams(l, d.batchSizeG)
    if (g == null || !l.ingredientId) return null
    byId.set(l.ingredientId, (byId.get(l.ingredientId) ?? 0) + g)
  }
  return [...byId.entries()].map(([ingredientId, g]) => ({ ingredientId, weightG: Math.round(g * 1e4) / 1e4 }))
}

/** Rows linked to the same library ingredient, which will be combined on save */
export function duplicateIngredients(d: ImportDraft): string[] {
  const seen = new Map<string, number>()
  for (const l of includedLines(d)) if (l.ingredientId) seen.set(l.ingredientId, (seen.get(l.ingredientId) ?? 0) + 1)
  return includedLines(d)
    .filter((l, i, arr) => l.ingredientId && seen.get(l.ingredientId)! > 1 && arr.findIndex(x => x.ingredientId === l.ingredientId) === i)
    .map(l => l.ingredientName ?? l.rawName)
}
