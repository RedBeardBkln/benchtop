import { randomUUID } from 'crypto'
import { asc, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { clients, ingredients, projects } from '@/lib/db/schema'
import { claudeJson } from '@/lib/ai-json'
import type { AuthContext } from '@/lib/auth/context'
import { projectLevel } from '@/lib/tenancy'
import { canCreateProject } from '@/lib/team-access'
import {
  IMPORT_UNITS, matchByName, matchIngredient, type ImportDraft, type ImportLine, type ImportUnit,
} from '@/lib/formulation-import'
import type { SheetText } from '@/lib/spreadsheet-text'

// Reading a spreadsheet into import drafts. SERVER ONLY.

type Extracted = {
  formulations: Array<{
    sheet: string
    name: string
    client: string
    project: string
    notes: string
    servingSizeG: number
    batchSizeG: number
    lines: Array<{
      name: string
      quantityText: string
      amount: number
      unit: ImportUnit | 'other' | ''
      supplier: string
      itemCode: string
      note: string
    }>
    steps: string[]
    warnings: string[]
  }>
}

const str = { type: 'string' }
const num = { type: 'number' }

const EXTRACT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['formulations'],
  properties: {
    formulations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['sheet', 'name', 'client', 'project', 'notes', 'servingSizeG', 'batchSizeG', 'lines', 'steps', 'warnings'],
        properties: {
          sheet: str, name: str, client: str, project: str, notes: str,
          servingSizeG: num, batchSizeG: num,
          lines: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'quantityText', 'amount', 'unit', 'supplier', 'itemCode', 'note'],
              properties: {
                name: str, quantityText: str, amount: num,
                unit: { type: 'string', enum: [...IMPORT_UNITS, 'other', ''] },
                supplier: str, itemCode: str, note: str,
              },
            },
          },
          steps: { type: 'array', items: str },
          warnings: { type: 'array', items: str },
        },
      },
    },
  },
}

const INSTRUCTIONS = `You are reading a food or supplement formulation (a recipe) that someone has kept in a spreadsheet, so it can be imported into a formulation app. The sheets are below, one line per row as "R<row number>: cell,cell,…".

Find every distinct formulation in the file (usually one; a workbook may hold one per sheet, or several side by side). For each, return:
- sheet: the sheet it came from.
- name: the product or formula name. If none is written, use a short name from the file or sheet name.
- client, project: only if the sheet names them (a customer, brand or project field). Otherwise "".
- notes: any free-text notes about the formula as a whole, else "".
- servingSizeG: the serving size in grams if stated (convert oz or lb to grams; a serving given only in mL or pieces → 0). 0 if not stated.
- batchSizeG: the total batch weight in grams if stated, else 0.
- lines: one entry per ingredient row, in the order they appear. name is the ingredient name exactly as written (keep brand or grade words). quantityText is the amount cell(s) as written. amount and unit are the amount used in the batch: prefer a weight column (g, kg, mg, lb, oz) over a percentage column when both exist; use "%" when only percentages are given; use "other" when the unit can't be expressed as one of those (mL, cups, pieces) and "" when there is no amount (amount 0 then). supplier, itemCode and note only when the row has them, else "".
- steps: the method / process instructions in order, one per step, if the file has them. Otherwise [].
- warnings: short notes for the person checking the import, e.g. that you assumed an unlabeled column was grams, or skipped rows you couldn't read. [] if none.

Leave out rows that are not ingredients: headers, subtotals and totals, cost or price summaries, nutrition-facts rows, blank rows, sign-off fields. Never invent ingredients, amounts or names that aren't in the file. If the file has no formulation at all, return an empty formulations list.`

const toUnit = (u: string): ImportUnit | null => ((IMPORT_UNITS as readonly string[]).includes(u) ? (u as ImportUnit) : null)
const blank = (s: string, max = 255) => (s.trim() ? s.trim().slice(0, max) : null)

// Matches the limits in importDraftSchema, so a draft read from any file can be saved
const MAX_LINES = 300
const MAX_STEPS = 100

export async function extractFormulations(sheets: SheetText[], fileName: string): Promise<Extracted['formulations']> {
  const body = sheets.map(s => `### Sheet: ${s.name}\n${s.text}`).join('\n\n')
  const out = await claudeJson<Extracted>({
    content: `${INSTRUCTIONS}\n\nFile name: ${fileName}\n\n${body}`,
    schema: EXTRACT_SCHEMA,
    effort: 'medium',
  })
  return out.formulations
}

/** Turn what was read from the file into drafts, linking whatever already exists in the account */
export async function buildDrafts(ctx: AuthContext, fileName: string, found: Extracted['formulations']): Promise<ImportDraft[]> {
  const accountId = ctx.account.id
  const [library, clientRows, projectRows] = await Promise.all([
    db.select({
      id: ingredients.id, name: ingredients.name, labelName: ingredients.labelName,
      itemCode: ingredients.itemCode, supplierName: ingredients.supplierName,
    }).from(ingredients).where(eq(ingredients.accountId, accountId)),
    db.select({ id: clients.id, name: clients.name }).from(clients)
      .where(eq(clients.accountId, accountId)).orderBy(asc(sql`lower(${clients.name})`)),
    db.select({ id: projects.id, name: projects.name, client: projects.client }).from(projects)
      .where(eq(projects.accountId, accountId)),
  ])
  // Only projects this person can add formulations to, and clients they can make projects for
  const editable = projectRows.filter(p => projectLevel(ctx, p) === 'edit')
  const choosableClients = clientRows.filter(c => canCreateProject(ctx.access, c.name))

  return found.map(f => {
    const project = matchByName(blank(f.project), editable)
    const client = matchByName(blank(f.client), choosableClients)
    const lines: ImportLine[] = f.lines.slice(0, MAX_LINES).map(l => {
      const { ingredient, candidates } = matchIngredient({ name: l.name, itemCode: l.itemCode, supplier: l.supplier }, library)
      return {
        key: randomUUID(),
        rawName: l.name.trim().slice(0, 500),
        rawQuantity: l.quantityText.trim().slice(0, 200),
        amount: l.amount > 0 ? l.amount : null,
        unit: toUnit(l.unit),
        supplier: blank(l.supplier),
        itemCode: blank(l.itemCode, 100),
        note: blank(l.note, 1000),
        ingredientId: ingredient?.id ?? null,
        ingredientName: ingredient?.name ?? null,
        candidates: candidates.map(c => ({ id: c.id, name: c.name })),
        status: ingredient ? 'matched' : 'open',
      }
    })
    const warnings = [...f.warnings]
    if (f.lines.length > MAX_LINES) warnings.push(`Only the first ${MAX_LINES} ingredient rows were read.`)
    const allPct = lines.length > 0 && lines.every(l => l.unit === '%')
    let batchSizeG = f.batchSizeG > 0 ? f.batchSizeG : null
    if (allPct && !batchSizeG) {
      batchSizeG = 1000
      warnings.push('The file gives percentages only, so the batch size was set to 1,000 g. Change it if you make a different amount.')
    }
    return {
      fileName,
      sheet: blank(f.sheet),
      name: f.name.trim().slice(0, 255),
      servingSizeG: f.servingSizeG > 0 ? f.servingSizeG : null,
      batchSizeG,
      notes: blank(f.notes, 5000),
      client: { rawName: blank(f.client), id: client?.id ?? null, skipped: false },
      project: { rawName: blank(f.project), id: project?.id ?? null, skipped: false },
      lines,
      steps: f.steps.filter(s => s.trim()).slice(0, MAX_STEPS).map(s => ({ key: randomUUID(), instruction: s.trim().slice(0, 2000), included: true })),
      warnings: warnings.slice(0, 50).map(w => w.slice(0, 500)),
    }
  })
}
