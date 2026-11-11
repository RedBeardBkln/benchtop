// Turns the account data into spreadsheets (Excel) or reports (Word and PDF). Pure: no I/O.

import { parseMarkdown, type Inline, type MdBlock } from '@/lib/chat-markdown'
import { formatAmt } from '@/lib/formulation-calc'
import { describeStepLoss } from '@/lib/process-loss'
import { SOUS_CHEF_NOTE_KINDS } from '@/lib/sous-chef'
import { cToF, trimNumber } from '@/lib/step-measurements'
import { TIME_ACTIVITIES } from '@/lib/time-tracking'
import { buildNfpModel, nfpModelSchema } from '@/lib/nfp-model'
import type { ExportClient, ExportData, ExportFormulation, ExportIngredient } from './data'
import { EXPORT_CATEGORIES, FORMAT_LABEL } from './model'
import type { Block, Column, ExportChoices, ExportFile, PanelFormat, PanelJob, Report, Section, SectionSheet, Workbook } from './model'

// ---------- Shared helpers ----------

/** Dates shown in the exporter's own time zone (the server runs in UTC) */
export type Clock = {
  /** "Nov 11, 2026, 3:04 PM" */
  dateTime: (d: Date | null | undefined) => string
  /** "Nov 11, 2026" */
  date: (d: Date | null | undefined) => string
  /** The same wall-clock time as a Date for a spreadsheet cell, which has no time zone */
  wall: (d: Date | null | undefined) => Date | null
}

export function makeClock(timeZone: string | undefined): Clock {
  let tz = 'UTC'
  try {
    if (timeZone) { new Intl.DateTimeFormat('en-US', { timeZone }); tz = timeZone }
  } catch { /* unknown zone: stay on UTC */ }
  const dt = new Intl.DateTimeFormat('en-US', { timeZone: tz, dateStyle: 'medium', timeStyle: 'short' })
  const d = new Intl.DateTimeFormat('en-US', { timeZone: tz, dateStyle: 'medium' })
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  return {
    dateTime: v => (v ? dt.format(v) : ''),
    date: v => (v ? d.format(v) : ''),
    wall: v => {
      if (!v) return null
      const p = Object.fromEntries(parts.formatToParts(v).map(x => [x.type, x.value]))
      return new Date(Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second))
    },
  }
}

const num = (v: string | null | undefined): number | null => (v == null || v === '' ? null : Number(v))

/** Up to `dp` decimals, trailing zeros dropped: 12.5, 0.333, 100 */
export function fmtNum(v: number | string | null | undefined, dp = 2): string {
  if (v == null || v === '') return ''
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return ''
  return n.toLocaleString('en-US', { maximumFractionDigits: dp, minimumFractionDigits: 0 })
}

const money = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? '' : `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const yesNo = (b: boolean) => (b ? 'Yes' : 'No')
const list = (xs: string[]) => xs.join(', ')

// Names Windows reserves for devices, with or without an extension
const RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i

/** A safe file or folder name for every operating system */
export function safeName(s: string, max = 80): string {
  const cleaned = s
    .replace(/[\u0000-\u001f<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, max)
    // Trimmed after cutting, so a cut never leaves a trailing dot or space (Windows drops them)
    .replace(/^[.\s]+|[.\s]+$/g, '')
  if (!cleaned) return 'Untitled'
  return RESERVED_NAME.test(cleaned) ? `${cleaned}_` : cleaned
}

/** Hands out zip paths, adding " (2)", " (3)" … when a name is already taken */
export function pathAllocator() {
  const used = new Set<string>()
  return (path: string, ext = '') => {
    const dotExt = ext ? `.${ext}` : ''
    let candidate = `${path}${dotExt}`
    for (let n = 2; used.has(candidate.toLowerCase()); n++) candidate = `${path} (${n})${dotExt}`
    used.add(candidate.toLowerCase())
    return candidate
  }
}

function fileExt(filePath: string): string {
  const m = /\.([a-z0-9]{1,8})$/i.exec(filePath)
  return m ? m[1].toLowerCase() : 'bin'
}

/** Where each uploaded ingredient document goes in the zip: Ingredient documents/<ingredient>/<label>.<ext> */
export function assignDocPaths(ingredients: ExportIngredient[]): Map<string, string> {
  const alloc = pathAllocator()
  const paths = new Map<string, string>()
  for (const i of ingredients) {
    for (const doc of i.docs) {
      paths.set(doc.id, alloc(`Ingredient documents/${safeName(i.name)}/${safeName(doc.label)}`, fileExt(doc.filePath)))
    }
  }
  return paths
}

const statusLabel = (f: ExportFormulation) =>
  [f.status === 'locked' ? 'Locked' : 'Draft', f.archivedAt ? 'archived' : f.iterationArchivedAt ? 'iteration archived' : null]
    .filter(Boolean).join(', ')

const modeLabel = (m: string) => (m === 'reverse' ? 'Reverse-engineered' : 'Ground up')

type ProjectTarget = {
  nutrient?: string | null; label?: string; comparator?: string; value?: number; valueMax?: number; unit?: string; basis?: string
}
const projectTargets = (targets: unknown): ProjectTarget[] => (Array.isArray(targets) ? (targets as ProjectTarget[]) : [])

const basisLabel = (b: string | undefined) => (b === 'per_serving' ? 'per serving' : 'per 100 g')

function targetText(t: { comparator?: string | null; value?: number | string | null; valueMax?: number | string | null; unit?: string | null }) {
  const v = fmtNum(t.value, 4)
  const unit = t.unit ? ` ${t.unit}` : ''
  if (t.comparator === 'range') return `${v}–${fmtNum(t.valueMax, 4)}${unit}`
  const cmp = t.comparator === '<=' ? '≤' : t.comparator === '>=' ? '≥' : '='
  return `${cmp} ${v}${unit}`
}

/** Process-step parameters as "Temp °C: 85; Time min: 10" */
function paramsText(params: unknown): string {
  if (!params || typeof params !== 'object') return ''
  const entries: string[] = []
  for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
    if (v == null || v === '') continue
    if (k === 'custom' && Array.isArray(v)) {
      for (const c of v as Array<{ k?: string; v?: unknown; key?: string; value?: unknown }>) {
        const key = c.k ?? c.key
        const val = c.v ?? c.value
        if (key && val != null && val !== '') entries.push(`${key}: ${String(val)}`)
      }
      continue
    }
    if (k === 'temp_c' && Number.isFinite(Number(v))) {
      entries.push(`Temp: ${trimNumber(Number(v), 1)} °C / ${trimNumber(cToF(Number(v)), 1)} °F`)
      continue
    }
    if (typeof v === 'object') {
      entries.push(`${humanKey(k)}: ${JSON.stringify(v)}`)
      continue
    }
    entries.push(`${humanKey(k)}: ${String(v)}`)
  }
  return entries.join('; ')
}

const KEY_LABELS: Record<string, string> = {
  start_time: 'Start', end_time: 'End', ph: 'pH', time: 'Time', speed: 'Speed', notes: 'Notes',
  time_min: 'Time (min)', solids_pct: 'Solids (%)', shear: 'Shear', pressure: 'Pressure',
}
const humanKey = (k: string) => KEY_LABELS[k] ?? k.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())

/** Raw-material cost, as the editor's costing figures it (supplier "use for cost" price, else manual cost per kg) */
function batchCost(f: ExportFormulation) {
  const c = f.cogs
  const priced = c.lines.length - c.missingCount > 0
  return {
    total: priced ? c.batchCost : null,
    perKgFinished: priced ? c.perKgFinished : null,
    perServing: priced ? c.perServing : null,
    perUnit: priced ? c.perUnit : null,
    unitsPerBatch: c.unitsPerBatch,
    missing: c.missingCount,
  }
}

/** The cost per kg and line cost the editor uses for one line */
const lineCost = (f: ExportFormulation, lineId: string) => f.cogs.lines.find(l => l.key === lineId)

const address = (a: { line1?: string; line2?: string; city?: string; region?: string; postalCode?: string; country?: string } | null | undefined) =>
  a ? [a.line1, a.line2, [a.city, a.region, a.postalCode].filter(Boolean).join(' '), a.country].filter(s => s && s.trim()).join(', ') : ''

const hours = (t: { startedAt: Date; endedAt: Date | null }) =>
  t.endedAt ? (t.endedAt.getTime() - t.startedAt.getTime()) / 3600000 : null

const activityLabel = (k: string) => TIME_ACTIVITIES.find(a => a.key === k)?.label ?? k

const roleLabel = (r: string) => ({ owner: 'Owner', admin: 'Admin', member: 'Member' } as Record<string, string>)[r] ?? r

const formulationLabel = (f: { name: string; version: number }) => `${f.name} v${f.version}`

function percentDv(perServing: number | undefined, dv: number | null) {
  return perServing != null && dv != null && dv > 0 ? (perServing / dv) * 100 : null
}

// ---------- Excel ----------

const col = (label: string): Column => ({ label })
const cols = (...labels: string[]) => labels.map(col)
const clientOf = (data: ExportData, projectId: string) => data.projects.find(p => p.id === projectId)?.client ?? null

/** Every iteration of each formulation, oldest first, keyed by family; families in name order */
export function formulationFamilies(data: ExportData): ExportFormulation[][] {
  const by = new Map<string, ExportFormulation[]>()
  for (const f of data.formulations) {
    if (!by.has(f.familyId)) by.set(f.familyId, [])
    by.get(f.familyId)!.push(f)
  }
  const latest = (its: ExportFormulation[]) => its[its.length - 1]
  return [...by.values()]
    .map(its => its.sort((a, b) => a.version - b.version))
    .sort((a, b) => latest(a).projectName.localeCompare(latest(b).projectName) || latest(a).name.localeCompare(latest(b).name))
}
function projectsWorkbook(data: ExportData, clock: Clock): Workbook {
  const { wall } = clock
  const families = new Map<string, Set<string>>()
  const iterations = new Map<string, number>()
  for (const f of data.formulations) {
    if (!families.has(f.projectId)) families.set(f.projectId, new Set())
    families.get(f.projectId)!.add(f.familyId)
    iterations.set(f.projectId, (iterations.get(f.projectId) ?? 0) + 1)
  }
  const projectsByClient = new Map(clientRows(data).map(r => [r.client, r.projects]))
  return {
    path: 'Projects and clients',
    sheets: [
      {
        name: 'Projects',
        columns: cols('Project', 'Client', 'Status', 'Objective', 'Protein target (%)', 'Required certifications',
          'Excluded allergens', 'Formulations', 'Iterations', 'Created', 'Updated', 'Project ID'),
        rows: data.projects.map(p => [
          p.name, p.client, p.status === 'archived' ? 'Archived' : 'Active', p.objectiveText, num(p.proteinTargetPct),
          list(p.requiredCerts), list(p.excludedAllergens), families.get(p.id)?.size ?? 0,
          iterations.get(p.id) ?? 0, wall(p.createdAt), wall(p.updatedAt), p.id,
        ]),
      },
      {
        name: 'Clients',
        columns: cols('Client', 'Status', 'Projects', 'Website', 'Legal name', 'Tax ID', 'Payment terms', 'Currency',
          'PO required', 'Billing email', 'Billing address', 'Accounting notes', 'Shipping address', 'Preferred carrier',
          'UPS account', 'FedEx account', 'DHL account', 'Other carrier accounts', 'Shipping notes', 'Notes', 'Added', 'Updated'),
        rows: data.clients.map(c => [
          c.name, c.archivedAt ? 'Archived' : 'Active', list((projectsByClient.get(c.name) ?? []).map(p => p.name)), c.website,
          c.legalName, c.taxId, c.paymentTerms, c.currency, yesNo(c.poRequired), c.billingEmail, address(c.billingAddress),
          c.accountingNotes, address(c.shippingAddress), c.preferredCarrier, c.upsAccount, c.fedexAccount, c.dhlAccount,
          (c.otherCarrierAccounts ?? []).map(a => `${a.carrier}: ${a.accountNumber}`).join('; '), c.shippingNotes, c.notes,
          wall(c.createdAt), wall(c.updatedAt),
        ]),
      },
      {
        name: 'Client contacts',
        columns: cols('Client', 'Name', 'Title', 'Email', 'Phone', 'Primary', 'Notes'),
        rows: data.clients.flatMap(c => c.contacts.map(k => [c.name, k.name, k.title, k.email, k.phone, yesNo(k.isPrimary), k.notes])),
      },
      {
        name: 'Project targets',
        columns: cols('Project', 'Target', 'Nutrient', 'Comparator', 'Value', 'Max value', 'Unit', 'Basis'),
        rows: data.projects.flatMap(p => projectTargets(p.targets).map(t => [
          p.name, t.label, t.nutrient, t.comparator, t.value, t.valueMax, t.unit, basisLabel(t.basis),
        ])),
      },
      {
        name: 'Time entries',
        columns: cols('Started', 'Ended', 'Hours', 'Client', 'Project', 'Activity', 'Task', 'Logged by', 'Billed', 'Billed on', 'Invoice'),
        rows: data.timeEntries.map(t => [
          wall(t.startedAt), wall(t.endedAt), hours(t), t.clientName, t.projectName, activityLabel(t.activity), t.task,
          t.userName, yesNo(t.billed), wall(t.billedAt), t.billedRef,
        ]),
      },
      {
        name: 'Team',
        columns: cols('Name', 'Email', 'Role', 'Joined'),
        rows: data.members.map(m => [m.name, m.email, roleLabel(m.role), wall(m.joinedAt)]),
      },
    ],
  }
}

/** One iteration laid out down a sheet: its settings, then ingredients, process, nutrition, notes */
export function iterationSheet(f: ExportFormulation, client: string | null, clock: Clock): SectionSheet {
  const { wall } = clock
  const cost = batchCost(f)
  const y = f.calc.processYield
  const sections: Section[] = [
    { t: 'title', text: formulationLabel(f) },
    {
      t: 'fields', fields: [
        ['Project', f.projectName], ['Client', client], ['Status', statusLabel(f)], ['Mode', modeLabel(f.mode)],
        ['Serving size (g)', num(f.servingSizeG)], ['Unit size (g)', num(f.unitSizeG)],
        ['Batch size (g)', num(f.batchSizeG)], ['Batch size locked', yesNo(f.batchLocked)],
        ['Input weight (g)', f.calc.totalWeightG], ['Finished weight (g)', y.finishedWeightG], ['Yield (%)', y.yieldPct],
        ['Batch cost ($)', cost.total], ['Cost per kg finished ($)', cost.perKgFinished],
        ['Cost per serving ($)', cost.perServing], ['Cost per unit ($)', cost.perUnit], ['Units per batch', cost.unitsPerBatch],
        ['What changed in this iteration', f.iterationNote], ['Notes', f.notes],
        ['Locked', wall(f.lockedAt)], ['Created', wall(f.createdAt)], ['Updated', wall(f.updatedAt)],
        ['Formulation ID', f.id], ['Family ID', f.familyId], ['Based on (formulation ID)', f.parentFormulationId],
      ],
    },
    {
      t: 'table', title: 'Ingredients', emptyText: 'No ingredients yet.',
      columns: cols('#', 'Ingredient', 'Weight (g)', '% of batch', 'Added after step', 'Stage %', 'Min %', 'Max %',
        'Quantity locked', 'Usage % locked', 'Cost per kg ($)', 'Line cost ($)', 'Ingredient ID'),
      rows: [
        ...f.lines.map((l, i) => {
          const c = lineCost(f, l.id)
          return [
            i + 1, l.ingredientName, num(l.weightG), num(l.pct), l.addedAfterStep, num(l.stagePct), num(l.minPct), num(l.maxPct),
            yesNo(l.locked), yesNo(l.pctLocked), c?.perKg ?? null, c?.cost ?? null, l.ingredientId,
          ]
        }),
        ...(f.lines.length ? [[null, 'Total', f.calc.totalWeightG, f.lines.reduce((s, l) => s + Number(l.pct), 0), null, null, null, null, null, null, null, cost.total, null]] : []),
      ],
    },
  ]
  if (f.steps.length) {
    sections.push({
      t: 'table', title: 'Process steps',
      columns: cols('Step', 'Instruction', 'Equipment', 'Parameters', 'Loss type', 'Loss amount', 'Loss unit'),
      rows: f.steps.map(s => [
        s.stepNo, s.instruction, s.equipmentName, paramsText(s.params),
        s.lossType === 'production' ? 'Production' : s.lossType === 'moisture' ? 'Moisture' : null,
        num(s.lossAmount), s.lossType ? (s.lossUnit === 'pct' ? '%' : 'g') : null,
      ]),
    })
  }
  sections.push({
    t: 'table', title: 'Nutrition (calculated, after process losses)', emptyText: 'No nutrient data: add ingredients with nutrient values.',
    columns: cols('Nutrient', 'Category', 'Unit', 'Per 100 g finished', 'Per serving', '% Daily Value (per serving)'),
    rows: f.calc.results.map(r => [
      r.name, r.category.replace(/^\w/, ch => ch.toUpperCase()), r.unit, r.perFinished100g, r.perServing ?? null, percentDv(r.perServing, r.dailyValueAmount),
    ]),
  })
  if (f.nfpPanels.length) {
    sections.push({
      t: 'table', title: 'Saved Nutrition Facts panels',
      columns: cols('Panel', 'Serving size (g)', 'FDA rounding rules', 'Saved'),
      rows: f.nfpPanels.map(p => [p.name, num(p.servingSizeG), p.rulesVersion, wall(p.createdAt)]),
    })
  }
  if (f.targets.length) {
    sections.push({
      t: 'table', title: 'Targets when locked',
      columns: cols('Target', 'Comparator', 'Value', 'Max value', 'Unit', 'Basis', 'Snapshot taken'),
      rows: f.targets.map(t => [t.nutrientName ?? t.label, t.comparator, num(t.value), num(t.valueMax), t.unit, basisLabel(t.basis), wall(t.snapshotAt)]),
    })
  }
  if (f.iterationNotes.length) {
    sections.push({
      t: 'table', title: 'Notes and findings',
      columns: cols('Date', 'Author', 'Note'),
      rows: f.iterationNotes.map(n => [wall(n.createdAt), n.authorEmail, n.body]),
    })
  }
  if (f.batchRuns.length) {
    sections.push({
      t: 'table', title: 'Production log',
      columns: cols('Produced', 'Batch multiplier', 'Batch weight (g)', 'Produced by', 'Notes'),
      rows: f.batchRuns.map(r => [wall(r.runAt), num(r.batchMultiplier), num(r.batchWeightG), r.runByName, r.notes]),
    })
  }
  return { name: `v${f.version}`, sections }
}
function suppliersWorkbook(data: ExportData, clock: Clock, docPaths: Map<string, string>): Workbook {
  const { wall } = clock
  const supplierIngredientCount = new Map<string, number>()
  for (const i of data.ingredients) for (const s of i.suppliers) supplierIngredientCount.set(s.supplierId, (supplierIngredientCount.get(s.supplierId) ?? 0) + 1)
  const ingNutrientCols = uniqueNutrients(data.ingredients.flatMap(i => i.nutrients.map(n => ({ id: n.nutrientId, name: n.name, unit: n.unit }))))
  return {
    path: 'Suppliers and ingredients',
    sheets: [
      {
        name: 'Suppliers',
        columns: cols('Supplier', 'Status', 'Website', 'Email', 'Phone', 'Address', 'Account number', 'Payment terms', 'Notes',
          'Ingredients supplied', 'Added', 'Updated'),
        rows: data.suppliers.map(s => [
          s.name, s.archivedAt ? 'Archived' : 'Active', s.websiteUrl, s.email, s.phone, address(s.address), s.accountNumber,
          s.paymentTerms, s.notes, supplierIngredientCount.get(s.id) ?? 0, wall(s.createdAt), wall(s.updatedAt),
        ]),
      },
      {
        name: 'Supplier contacts',
        columns: cols('Supplier', 'Name', 'Title', 'Email', 'Phone', 'Primary', 'Notes'),
        rows: data.suppliers.flatMap(s => s.contacts.map(k => [s.name, k.name, k.title, k.email, k.phone, yesNo(k.isPrimary), k.notes])),
      },
      {
        name: 'Supplier ingredients',
        columns: cols('Supplier', 'Ingredient', 'Category', 'Item code', 'Pack size', 'Pack unit', 'Cost per unit ($)', 'Used for cost', 'Preferred', 'Notes'),
        // Every link, by supplier
        rows: data.ingredients
          .flatMap(i => i.suppliers.map(l => ({ i, l })))
          .sort((a, b) => a.l.supplierName.localeCompare(b.l.supplierName) || a.i.name.localeCompare(b.i.name))
          .map(({ i, l }) => [l.supplierName, i.name, i.category, i.itemCode, num(l.packSize), l.packUnit, num(l.costPerUnit), yesNo(l.useForCost), yesNo(l.isPreferred), l.notes]),
      },
      {
        name: 'All ingredients',
        columns: cols('Ingredient', 'Status', 'Label name', 'Brand', 'Supplier', 'Item code', 'Category', 'Subcategory', 'Micro category',
          'Source', 'USDA FDC ID', 'Verification', 'On hand', 'Stock (g)', 'Formulation cost per kg ($)', 'Cost from',
          'Manual cost per kg ($)', 'Cost unit', 'Moisture (%)', 'Density (g/mL)', 'Naturally derived', 'Isolate or concentrate', 'AB SPI',
          'Allergens', 'Certifications', 'Sub-ingredients', 'Notes', 'Created', 'Updated', 'Ingredient ID'),
        rows: data.ingredients.map(i => [
          i.name, i.archivedAt ? 'Archived' : 'Active', i.labelName, i.brandName, i.supplierName, i.itemCode, i.category, i.subcategory, i.microCategory,
          sourceLabel(i.sourceType), i.fdcId, i.verification === 'verified' ? 'Verified' : 'Unverified', yesNo(i.onHand),
          num(i.stockG), i.cost?.perKg ?? null, costSource(i.cost), num(i.defaultCostPerKg), i.costUnit, num(i.moisturePct),
          num(i.densityGPerMl), yesNo(i.naturallyDerived), yesNo(i.isIsolateOrConcentrate), yesNo(i.isAbSpi),
          list(i.allergens), list(i.certs), list(i.subIngredients), i.notes, wall(i.createdAt), wall(i.updatedAt), i.id,
        ]),
      },
      {
        name: 'Nutrition per 100 g',
        columns: [col('Ingredient'), ...ingNutrientCols.map(n => col(`${n.name} (${n.unit})`))],
        rows: data.ingredients.map(i => {
          const by = new Map(i.nutrients.map(n => [n.nutrientId, n.amountPer100g]))
          return [i.name, ...ingNutrientCols.map(n => by.get(n.id) ?? null)]
        }),
      },
      {
        name: 'Nutrient values and sources',
        columns: cols('Ingredient', 'Nutrient', 'Unit', 'Amount per 100 g', 'Source', 'Source URL'),
        rows: data.ingredients.flatMap(i => i.nutrients.map(n => [i.name, n.name, n.unit, n.amountPer100g, n.sourceRef, n.sourceUrl])),
      },
      {
        name: 'Documents',
        columns: cols('Ingredient', 'Document', 'File in this export', 'Uploaded'),
        rows: data.ingredients.flatMap(i => i.docs.map(d => [i.name, d.label, docPaths.get(d.id) ?? '', wall(d.uploadedAt)])),
      },
      {
        name: 'Lab intake',
        columns: cols('As entered', 'Quantity', 'Unit', 'Status', 'Identified as', 'Category', 'Subcategory', 'Micro category', 'Confidence', 'Notes', 'Library ingredient', 'Added'),
        rows: data.intake.map(r => [
          r.rawName, num(r.quantity), r.quantityUnit, r.status.replace(/^\w/, ch => ch.toUpperCase()), r.name, r.category, r.subcategory,
          r.microCategory, r.confidence, r.aiNotes, r.ingredientName, wall(r.createdAt),
        ]),
      },
      {
        name: 'Equipment',
        columns: cols('Equipment', 'Added'),
        rows: data.equipment.map(e => [e.name, wall(e.createdAt)]),
      },
    ],
  }
}

function uniqueNutrients(xs: Array<{ id: string; name: string; unit: string }>) {
  const seen = new Map<string, { id: string; name: string; unit: string }>()
  for (const x of xs) if (!seen.has(x.id)) seen.set(x.id, x)
  return [...seen.values()]
}
/** Each client record with its projects, then any projects with no client */
function clientRows(data: ExportData) {
  const key = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()
  const taken = new Set<string>()
  const rows = data.clients.map(c => {
    const projects = data.projects.filter(p => p.clientId === c.id || (!p.clientId && p.client && key(p.client) === key(c.name)))
    projects.forEach(p => taken.add(p.id))
    return { client: c.name, record: c as ExportClient | null, projects }
  })
  const rest = data.projects.filter(p => !taken.has(p.id))
  // Projects naming a client that has no record (from before client records existed)
  const byName = new Map<string, typeof rest>()
  for (const p of rest) {
    const name = p.client?.trim() || '(No client)'
    if (!byName.has(name)) byName.set(name, [])
    byName.get(name)!.push(p)
  }
  for (const [client, projects] of [...byName.entries()].sort(([a], [b]) => (a === '(No client)' ? 1 : b === '(No client)' ? -1 : a.localeCompare(b)))) {
    rows.push({ client, record: null, projects })
  }
  return rows
}
const sourceLabel = (s: string) =>
  ({ usda: 'USDA', supplier: 'Supplier', manual: 'Manual', ai_extracted: 'AI extracted', formulation: 'From a formulation' } as Record<string, string>)[s] ?? s

const costSource = (c: ExportIngredient['cost']) =>
  !c ? null : c.source === 'supplier' ? `Supplier price (${c.supplierName})` : 'Manual cost'

const noteKindLabel = (k: string) => (SOUS_CHEF_NOTE_KINDS as Record<string, { label: string }>)[k]?.label ?? k

// ---------- Word and PDF ----------

/** A report table, without columns that are empty in every row (no equipment, no costs, …) */
function table(columns: Column[], rows: string[][], emptyText?: string): Block {
  const keep = columns.map((_, i) => !rows.length || rows.some(r => (r[i] ?? '').trim() !== ''))
  return { t: 'table', columns: columns.filter((_, i) => keep[i]), rows: rows.map(r => r.filter((_, i) => keep[i])), emptyText }
}
const c = (label: string, width = 1, numeric = false): Column => ({ label, width, numeric })
const c_ = c

/** Every file of the export in the chosen formats, skipped parts left out (Nutrition Facts panels are drawn by the browser: see panelJobs) */
export function buildExportFiles(data: ExportData, clock: Clock, docPaths: Map<string, string>, choices: ExportChoices): ExportFile[] {
  const files: ExportFile[] = []
  const alloc = pathAllocator()
  const stamp = `Exported ${clock.dateTime(data.generatedAt)}${data.userEmail ? ` by ${data.userEmail}` : ''}`
  const report = (format: 'docx' | 'pdf', r: Report): ExportFile => ({ kind: 'report', format, report: r })

  // Projects and clients
  if (choices.projects === 'skip') { /* left out */ }
  else if (choices.projects === 'xlsx') files.push({ kind: 'workbook', book: projectsWorkbook(data, clock) })
  else files.push(report(choices.projects, { path: 'Projects and clients', title: 'Projects and clients', subtitle: stamp, blocks: projectsReport(data, clock) }))

  // One file per formulation, holding every iteration
  for (const its of choices.formulations === 'skip' ? [] : formulationFamilies(data)) {
    const latest = its[its.length - 1]
    const client = clientOf(data, latest.projectId)
    const path = alloc(`Formulations/${safeName(latest.projectName)}/${safeName(latest.name)}`)
    if (choices.formulations === 'xlsx') {
      files.push({ kind: 'workbook', book: { path, sheets: its.map(f => iterationSheet(f, client, clock)) } })
    } else {
      files.push(report(choices.formulations as 'docx' | 'pdf', {
        path,
        title: latest.name,
        subtitle: [latest.projectName, client, `${its.length} iteration${its.length === 1 ? '' : 's'}`].filter(Boolean).join(' · '),
        blocks: its.flatMap((f, i) => [
          ...(i > 0 ? [{ t: 'pagebreak' } as Block] : []),
          { t: 'h1', text: formulationLabel(f) } as Block,
          ...formulationReport(f, clock),
        ]),
      }))
    }
  }

  // Suppliers with the ingredients they supply, and the whole ingredient library
  if (choices.suppliers === 'skip') { /* left out */ }
  else if (choices.suppliers === 'xlsx') files.push({ kind: 'workbook', book: suppliersWorkbook(data, clock, docPaths) })
  else files.push(report(choices.suppliers, { path: 'Suppliers and ingredients', title: 'Suppliers and ingredients', subtitle: stamp, blocks: suppliersAndIngredientsReport(data, clock, docPaths) }))

  // Sous Chef
  if (choices.sousChef !== 'skip') {
    files.push(report(choices.sousChef, { path: 'Sous Chef/Conversations', title: 'Sous Chef conversations', subtitle: `Your own conversations. ${stamp}`, blocks: conversationsReport(data, clock) }))
    files.push(report(choices.sousChef, { path: 'Sous Chef/Lab notebook', title: 'Sous Chef lab notebook', subtitle: stamp, blocks: notebookReport(data, clock) }))
  }

  return files
}

/** Each saved Nutrition Facts panel as saved; iterations with nutrient data but no saved panel get a standard one */
export function panelJobs(data: ExportData, format: PanelFormat): PanelJob[] {
  const alloc = pathAllocator()
  return formulationFamilies(data).flatMap(its => its.flatMap(f => {
    const base = `Nutrition Facts/${safeName(f.projectName)}/${safeName(f.name, 60)} v${f.version}`
    // Saved panels whose stored model no longer reads are skipped; if none reads, the standard panel stands in
    const saved = f.nfpPanels.flatMap(p => {
      const parsed = nfpModelSchema.safeParse(p.model)
      return parsed.success ? [{ name: p.name, model: parsed.data }] : []
    })
    if (saved.length) return saved.map(p => ({ path: alloc(`${base} - ${safeName(p.name, 40)}`, format), model: p.model }))
    if (!f.calc.results.length) return []
    const servingSizeG = num(f.servingSizeG) ?? undefined
    // As the NFP dialog counts it: per-serving values are on the finished basis, so servings are too
    const finishedG = f.calc.processYield.finishedWeightG
    return [{
      path: alloc(base, format),
      model: buildNfpModel({
        servingSizeG,
        servingsPerContainer: servingSizeG && servingSizeG > 0 && finishedG > 0 ? finishedG / servingSizeG : undefined,
        results: f.calc.results,
      }),
    }]
  }))
}

function suppliersAndIngredientsReport(data: ExportData, clock: Clock, docPaths: Map<string, string>): Block[] {
  const blocks: Block[] = [...suppliersReport(data, clock), { t: 'pagebreak' }, { t: 'h1', text: 'Ingredient library' }, ...librarySummary(data)]
  for (const i of data.ingredients) {
    const category = [i.category, i.subcategory, i.microCategory].filter(Boolean).join(' › ')
    blocks.push({ t: 'pagebreak' }, { t: 'h1', text: i.name })
    if (category) blocks.push({ t: 'p', text: category, muted: true })
    blocks.push(...ingredientReport(i, clock, docPaths))
  }
  return blocks
}
function projectsReport(data: ExportData, clock: Clock): Block[] {
  const blocks: Block[] = [{ t: 'h1', text: 'Clients' }]
  const rows = clientRows(data)
  if (!rows.length) blocks.push({ t: 'p', text: 'No clients or projects yet.', muted: true })
  for (const r of rows) {
    blocks.push({ t: 'h2', text: r.client })
    const c = r.record
    if (c) {
      blocks.push({
        t: 'fields', fields: ([
          ['Status', c.archivedAt ? 'Archived' : 'Active'],
          ['Website', c.website], ['Legal name', c.legalName], ['Tax ID', c.taxId], ['Payment terms', c.paymentTerms],
          ['Currency', c.currency], ['PO required', c.poRequired ? 'Yes' : null], ['Billing email', c.billingEmail],
          ['Billing address', address(c.billingAddress)], ['Accounting notes', c.accountingNotes],
          ['Shipping address', address(c.shippingAddress)], ['Preferred carrier', c.preferredCarrier],
          ['Carrier accounts', [
            c.upsAccount && `UPS ${c.upsAccount}`, c.fedexAccount && `FedEx ${c.fedexAccount}`, c.dhlAccount && `DHL ${c.dhlAccount}`,
            ...(c.otherCarrierAccounts ?? []).map(a => `${a.carrier} ${a.accountNumber}`),
          ].filter(Boolean).join(', ')],
          ['Shipping notes', c.shippingNotes], ['Notes', c.notes],
        ] as Array<[string, string | null]>).filter((x): x is [string, string] => !!x[1]),
      })
      if (c.contacts.length) {
        blocks.push({ t: 'h3', text: 'Contacts' },
          table([c_('Name', 2), c_('Title', 2), c_('Email', 2.5), c_('Phone', 1.5)],
            c.contacts.map(k => [k.name + (k.isPrimary ? ' (primary)' : ''), k.title ?? '', k.email ?? '', k.phone ?? ''])))
      }
    }
    blocks.push({ t: 'p', text: r.projects.length ? `Projects: ${list(r.projects.map(p => p.name))}` : 'No projects.', muted: true })
  }

  blocks.push({ t: 'pagebreak' }, { t: 'h1', text: 'Projects' })
  if (!data.projects.length) blocks.push({ t: 'p', text: 'No projects yet.', muted: true })
  for (const p of data.projects) {
    const forms = data.formulations.filter(f => f.projectId === p.id)
    const families = new Map<string, ExportFormulation[]>()
    for (const f of forms) {
      if (!families.has(f.familyId)) families.set(f.familyId, [])
      families.get(f.familyId)!.push(f)
    }
    blocks.push(
      { t: 'h2', text: p.name },
      {
        t: 'fields', fields: [
          ['Client', p.client ?? '—'],
          ['Status', p.status === 'archived' ? 'Archived' : 'Active'],
          ['Objective', p.objectiveText ?? '—'],
          ['Protein target', p.proteinTargetPct ? `${fmtNum(p.proteinTargetPct, 3)}%` : '—'],
          ['Required certifications', list(p.requiredCerts) || '—'],
          ['Excluded allergens', list(p.excludedAllergens) || '—'],
          ['Created', clock.dateTime(p.createdAt)],
          ['Updated', clock.dateTime(p.updatedAt)],
        ],
      },
    )
    const targets = projectTargets(p.targets)
    if (targets.length) {
      blocks.push({ t: 'h3', text: 'Nutrition targets' },
        table([c_('Target', 3), c_('Requirement', 2), c_('Basis', 1.5)],
          targets.map(t => [t.label || t.nutrient || '', targetText(t), basisLabel(t.basis)])))
    }
    blocks.push({ t: 'h3', text: 'Formulations' },
      table([c_('Formulation', 3), c_('Iterations', 1, true), c_('Latest', 1), c_('Status', 2), c_('Updated', 2)],
        [...families.values()].map(its => {
          const latest = its.reduce((a, b) => (b.version > a.version ? b : a))
          return [latest.name, String(its.length), `v${latest.version}`, statusLabel(latest), clock.date(latest.updatedAt)]
        }), 'No formulations in this project.'))
  }

  if (data.timeEntries.length) {
    const total = data.timeEntries.reduce((s, t) => s + (hours(t) ?? 0), 0)
    blocks.push({ t: 'pagebreak' }, { t: 'h1', text: 'Time entries' },
      { t: 'p', muted: true, text: `${fmtNum(total, 2)} hours logged, ${fmtNum(data.timeEntries.filter(t => !t.billed).reduce((s, t) => s + (hours(t) ?? 0), 0), 2)} not yet billed.` },
      table([c_('Date', 1.6), c_('Client', 1.8), c_('Project', 1.8), c_('Activity', 1.5), c_('Task', 3), c_('Hours', 0.8, true), c_('Billed', 0.8), c_('By', 1.5)],
        data.timeEntries.map(t => [
          clock.date(t.startedAt), t.clientName, t.projectName ?? '', activityLabel(t.activity), t.task,
          t.endedAt ? fmtNum(hours(t), 2) : 'running', yesNo(t.billed), t.userName ?? '',
        ])))
  }
  blocks.push({ t: 'h1', text: 'Team' },
    table([c_('Name', 2), c_('Email', 3), c_('Role', 1), c_('Joined', 1.5)],
      data.members.map(m => [m.name ?? '', m.email ?? '', roleLabel(m.role), clock.date(m.joinedAt)])))
  return blocks
}

function formulationReport(f: ExportFormulation, clock: Clock): Block[] {
  const cost = batchCost(f)
  const y = f.calc.processYield
  const blocks: Block[] = [
    {
      t: 'fields', fields: [
        ['Status', statusLabel(f)],
        ['Mode', modeLabel(f.mode)],
        ['Serving size', f.servingSizeG ? `${fmtNum(f.servingSizeG)} g` : '—'],
        ['Batch size', f.batchSizeG ? `${fmtNum(f.batchSizeG)} g${f.batchLocked ? ' (locked)' : ''}` : '—'],
        ['Input weight', `${fmtNum(f.calc.totalWeightG)} g`],
        ['Finished weight', `${fmtNum(y.finishedWeightG)} g (yield ${fmtNum(y.yieldPct, 1)}%)`],
        ['Batch cost', cost.total == null ? '—' : `${money(cost.total)}${cost.perKgFinished != null ? ` (${money(cost.perKgFinished)} per kg finished)` : ''}${cost.missing ? `; ${cost.missing} ingredient${cost.missing === 1 ? '' : 's'} without a cost` : ''}`],
        ...(cost.perServing != null ? [['Cost per serving', money(cost.perServing)] as [string, string]] : []),
        ...(cost.perUnit != null ? [['Cost per unit', `${money(cost.perUnit)}${f.unitSizeG ? ` (${fmtNum(f.unitSizeG)} g unit)` : ''}`] as [string, string]] : []),
        ...(f.lockedAt ? [['Locked', clock.dateTime(f.lockedAt)] as [string, string]] : []),
        ['Created', clock.dateTime(f.createdAt)],
        ['Updated', clock.dateTime(f.updatedAt)],
      ],
    },
  ]
  if (f.iterationNote) blocks.push({ t: 'h3', text: 'What changed in this iteration' }, { t: 'p', text: f.iterationNote })
  if (f.notes) blocks.push({ t: 'h3', text: 'Notes' }, { t: 'p', text: f.notes })

  blocks.push({ t: 'h2', text: 'Ingredients' })
  const lineRows = f.lines.map((l, i) => {
    const lc = lineCost(f, l.id)
    const flags = [
      l.addedAfterStep ? `added after step ${l.addedAfterStep}` : null, l.locked ? 'qty locked' : null, l.pctLocked ? '% locked' : null,
    ].filter(Boolean).join(', ')
    return [
      String(i + 1), l.ingredientName + (flags ? ` (${flags})` : ''), fmtNum(l.weightG, 2), `${fmtNum(l.pct, 3)}%`,
      lc?.perKg == null ? '' : money(lc.perKg), lc?.cost == null ? '' : money(lc.cost),
    ]
  })
  if (f.lines.length) {
    lineRows.push(['', 'Total', fmtNum(f.calc.totalWeightG, 2), `${fmtNum(f.lines.reduce((s, l) => s + Number(l.pct), 0), 3)}%`, '', money(cost.total)])
  }
  blocks.push(table([c('#', 0.4, true), c('Ingredient', 4), c('Grams', 1.2, true), c('% of batch', 1.2, true), c('Cost / kg', 1.1, true), c('Cost', 1.1, true)],
    lineRows, 'No ingredients yet.'))

  if (f.steps.length) {
    blocks.push({ t: 'h2', text: 'Process' },
      table([c('Step', 0.5, true), c('Instruction', 4), c('Equipment', 1.4), c('Parameters', 2), c('Loss', 1.6)],
        f.steps.map(s => [String(s.stepNo), s.instruction, s.equipmentName ?? '', paramsText(s.params), describeStepLoss(s) ?? ''])))
  }

  blocks.push({ t: 'h2', text: 'Nutrition' })
  const serving = num(f.servingSizeG)
  const rows = f.calc.results.map(r => [
    r.name, `${formatAmt(r.perFinished100g, r.unit)} ${r.unit}`,
    r.perServing != null ? `${formatAmt(r.perServing, r.unit)} ${r.unit}` : '',
    (() => { const dv = percentDv(r.perServing, r.dailyValueAmount); return dv == null ? '' : `${Math.round(dv)}%` })(),
  ])
  blocks.push(
    { t: 'p', text: `Calculated from the ingredients' nutrient values, after process losses.${serving ? ` Serving size ${fmtNum(serving)} g.` : ' No serving size set.'}`, muted: true },
    table([c('Nutrient', 3), c('Per 100 g', 1.5, true), c('Per serving', 1.5, true), c('% DV', 1, true)], rows, 'No nutrient data: add ingredients with nutrient values.'),
  )

  if (f.targets.length) {
    blocks.push({ t: 'h2', text: 'Targets when locked' },
      table([c('Target', 3), c('Requirement', 2), c('Basis', 1.5)],
        f.targets.map(t => [t.nutrientName ?? t.label ?? '', targetText(t), basisLabel(t.basis)])))
  }
  if (f.iterationNotes.length) {
    blocks.push({ t: 'h2', text: 'Notes and findings' })
    for (const n of f.iterationNotes) {
      blocks.push({ t: 'h3', text: `${clock.dateTime(n.createdAt)}${n.authorEmail ? ` · ${n.authorEmail}` : ''}` }, { t: 'p', text: n.body })
    }
  }
  if (f.batchRuns.length) {
    blocks.push({ t: 'h2', text: 'Production log' },
      table([c('Produced', 2), c('Batch multiplier', 1, true), c('Notes', 4)],
        f.batchRuns.map(r => [clock.dateTime(r.runAt), `×${fmtNum(r.batchMultiplier, 4)}`, r.notes ?? ''])))
  }
  return blocks
}

function librarySummary(data: ExportData): Block[] {
  return [
    { t: 'p', muted: true, text: 'Each ingredient follows on its own page, with its nutrient values, suppliers and documents.' },
    table([c('Ingredient', 3), c('Category', 2), c('Brand / supplier', 2), c('On hand', 0.8), c('Cost / kg', 1, true)],
      data.ingredients.map(i => [
        i.name, [i.category, i.subcategory, i.microCategory].filter(Boolean).join(' › '),
        [i.brandName, i.supplierName].filter(Boolean).join(' / '), yesNo(i.onHand), money(num(i.defaultCostPerKg)),
      ]), 'No ingredients yet.'),
  ]
}
function ingredientReport(i: ExportIngredient, clock: Clock, docPaths: Map<string, string>): Block[] {
  const fields = ([
    ['Status', i.archivedAt ? 'Archived' : null],
    ['Label name', i.labelName],
    ['Brand', i.brandName],
    ['Supplier', i.supplierName],
    ['Item code', i.itemCode],
    ['Source', `${sourceLabel(i.sourceType)}${i.fdcId ? ` (USDA FDC ${i.fdcId})` : ''}`],
    ['Verification', i.verification === 'verified' ? 'Verified' : 'Unverified'],
    ['On hand', `${yesNo(i.onHand)}${i.stockG ? ` · ${fmtNum(i.stockG)} g in stock` : ''}`],
    ['Formulation cost', i.cost ? `${money(i.cost.perKg)} per kg (${costSource(i.cost)?.toLowerCase()})` : null],
    ['Moisture', i.moisturePct ? `${fmtNum(i.moisturePct, 3)}%` : null],
    ['Density', i.densityGPerMl ? `${fmtNum(i.densityGPerMl, 4)} g/mL` : null],
    ['Naturally derived', yesNo(i.naturallyDerived)],
    ['Isolate or concentrate', yesNo(i.isIsolateOrConcentrate)],
    ['Allergens', list(i.allergens)],
    ['Certifications', list(i.certs)],
    ['Sub-ingredients', list(i.subIngredients)],
    ['Notes', i.notes],
    ['Updated', clock.dateTime(i.updatedAt)],
  ] as Array<[string, string | null]>).filter((x): x is [string, string] => !!x[1])

  const blocks: Block[] = [
    { t: 'fields', fields },
    { t: 'h2', text: 'Nutrition per 100 g' },
    table([c_('Nutrient', 3), c_('Amount', 1.5, true), c_('Source', 3)],
      i.nutrients.map(n => [n.name, `${formatAmt(n.amountPer100g, n.unit)} ${n.unit}`, n.sourceRef]), 'No nutrient values recorded.'),
  ]
  if (i.suppliers.length) {
    blocks.push({ t: 'h2', text: 'Suppliers' },
      table([c_('Supplier', 2.5), c_('Pack', 1.5), c_('Cost per unit', 1.2, true), c_('Used for cost', 1), c_('Preferred', 0.9), c_('Notes', 2.5)],
        i.suppliers.map(s => [s.supplierName, [fmtNum(s.packSize, 4), s.packUnit].filter(Boolean).join(' '), money(num(s.costPerUnit)), yesNo(s.useForCost), yesNo(s.isPreferred), s.notes ?? ''])))
  }
  if (i.docs.length) {
    blocks.push({ t: 'h2', text: 'Documents' },
      table([c_('Document', 2), c_('File in this export', 4), c_('Uploaded', 1.5)],
        i.docs.map(d => [d.label, docPaths.get(d.id) ?? '', clock.date(d.uploadedAt)])))
  }
  return blocks
}
function suppliersReport(data: ExportData, clock: Clock): Block[] {
  const blocks: Block[] = [{ t: 'h1', text: 'Suppliers' }]
  if (!data.suppliers.length) blocks.push({ t: 'p', text: 'No suppliers yet.', muted: true })
  for (const s of data.suppliers) {
    const ings = data.ingredients.flatMap(i => i.suppliers.filter(l => l.supplierId === s.id).map(l => ({ i, l })))
    blocks.push({ t: 'h2', text: s.name }, {
      t: 'fields', fields: ([
        ['Status', s.archivedAt ? 'Archived' : null],
        ['Website', s.websiteUrl], ['Email', s.email], ['Phone', s.phone], ['Address', address(s.address)],
        ['Account number', s.accountNumber], ['Payment terms', s.paymentTerms], ['Notes', s.notes],
        ['Added', clock.date(s.createdAt)],
      ] as Array<[string, string | null]>).filter((x): x is [string, string] => !!x[1]),
    })
    if (s.contacts.length) {
      blocks.push({ t: 'h3', text: 'Contacts' },
        table([c_('Name', 2), c_('Title', 2), c_('Email', 2.5), c_('Phone', 1.5)],
          s.contacts.map(k => [k.name + (k.isPrimary ? ' (primary)' : ''), k.title ?? '', k.email ?? '', k.phone ?? ''])))
    }
    if (ings.length) {
      blocks.push({ t: 'h3', text: 'Ingredients supplied' },
        table([c_('Ingredient', 3), c_('Pack', 1.5), c_('Cost per unit', 1.2, true), c_('Used for cost', 1), c_('Preferred', 0.9)],
          ings.map(({ i, l }) => [i.name, [fmtNum(l.packSize, 4), l.packUnit].filter(Boolean).join(' '), money(num(l.costPerUnit)), yesNo(l.useForCost), yesNo(l.isPreferred)])))
    }
  }
  blocks.push({ t: 'h1', text: 'Equipment' },
    data.equipment.length
      ? { t: 'bullets', items: data.equipment.map(e => e.name) }
      : { t: 'p', text: 'No equipment yet.', muted: true })
  if (data.intake.length) {
    blocks.push({ t: 'h1', text: 'Lab intake' },
      table([c_('As entered', 2.5), c_('Quantity', 1.2, true), c_('Status', 1.2), c_('Identified as', 2.5), c_('Category', 2)],
        data.intake.map(r => [r.rawName, [fmtNum(r.quantity, 4), r.quantityUnit].filter(Boolean).join(' '), r.status, r.name ?? '', r.category ?? ''])))
  }
  return blocks
}

function notebookReport(data: ExportData, clock: Clock): Block[] {
  const blocks: Block[] = [{
    t: 'p', muted: true,
    text: 'Decisions, preferences, learnings and constraints recorded by the team and Sous Chef. Active notes are given to Sous Chef in every conversation; retired ones are kept for the record.',
  }]
  const section = (title: string, notes: ExportData['notebook']) => {
    blocks.push({ t: 'h1', text: title })
    if (!notes.length) { blocks.push({ t: 'p', text: 'None.', muted: true }); return }
    blocks.push(table([c('Kind', 1), c('Note', 4.4), c('About', 1.8), c('Recorded', 2.8)],
      notes.map(n => [
        noteKindLabel(n.kind), n.content, [n.projectName, n.formulationLabel].filter(Boolean).join(' · '),
        `${clock.date(n.createdAt)}${n.createdByName ? `\n${n.createdByName}` : ''}${n.retiredAt ? `\nRetired ${clock.date(n.retiredAt)}` : ''}`,
      ])))
  }
  section('Active notes', data.notebook.filter(n => !n.retiredAt))
  section('Retired notes', data.notebook.filter(n => n.retiredAt))
  return blocks
}

function conversationsReport(data: ExportData, clock: Clock): Block[] {
  const blocks: Block[] = []
  if (!data.conversations.length) blocks.push({ t: 'p', text: 'You have no Sous Chef conversations.', muted: true })
  data.conversations.forEach((conv, idx) => {
    if (idx > 0) blocks.push({ t: 'pagebreak' })
    blocks.push({ t: 'h1', text: conv.title }, {
      t: 'fields', fields: [
        ['Linked to', conv.linkedTo ?? 'Nothing in particular'],
        ['Started', clock.dateTime(conv.createdAt)],
        ['Messages', String(conv.messages.length)],
      ],
    })
    for (const m of conv.messages) {
      blocks.push({ t: 'h3', text: `${m.role === 'user' ? 'You' : 'Sous Chef'} · ${clock.dateTime(m.createdAt)}` })
      if (m.role === 'assistant' && m.activity.length) blocks.push({ t: 'p', text: m.activity.join(' · '), muted: true })
      blocks.push(...(m.role === 'assistant' ? markdownBlocks(m.content) : [{ t: 'p' as const, text: m.content }]))
    }
  })
  return blocks
}

// Sous Chef replies are Markdown; documents get the same structure as plain text
const inlineText = (xs: Inline[]): string =>
  xs.map(x => (x.t === 'text' || x.t === 'code' ? x.v : x.t === 'link' ? `${inlineText(x.c)} (${x.href})` : inlineText(x.c))).join('')

export function markdownBlocks(src: string): Block[] {
  return parseMarkdown(src).flatMap((b: MdBlock): Block[] => {
    switch (b.t) {
      case 'h': return [{ t: 'h3', text: inlineText(b.c) }]
      case 'p': return [{ t: 'p', text: inlineText(b.c) }]
      case 'quote': return [{ t: 'p', text: inlineText(b.c), muted: true }]
      case 'code': return [{ t: 'p', text: b.v, mono: true }]
      case 'ul':
      case 'ol': return [{ t: 'bullets', numbered: b.t === 'ol', items: b.items.map(inlineText) }]
      case 'table': return [table(b.head.map(h => c(inlineText(h))), b.rows.map(r => r.map(inlineText)))]
      case 'hr': return []
    }
  })
}

// ---------- README ----------

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export function buildReadme(opts: {
  data: ExportData
  clock: Clock
  choices: ExportChoices
  panels: number
  /** Documents that couldn't be read from storage */
  missingDocs: string[]
  /** Documents left out to keep the zip under the size it can be downloaded at */
  leftOutDocs?: string[]
}): string {
  const { data, clock, choices, panels, missingDocs, leftOutDocs = [] } = opts
  const families = new Set(data.formulations.map(f => f.familyId)).size
  const docs = data.ingredients.reduce((sum, i) => sum + i.docs.length, 0) - missingDocs.length - leftOutDocs.length
  const clients = clientRows(data).filter(c => c.client !== '(No client)').length
  const as = (k: keyof ExportChoices) => `(${FORMAT_LABEL[choices[k]]})`
  const parts: Array<[keyof ExportChoices, string]> = [
    ['projects', `- Projects and clients ${as('projects')}: ${plural(data.projects.length, 'project')} and ${plural(clients, 'client')} with contacts, nutrition targets,`
      + ` ${plural(data.timeEntries.length, 'time entry', 'time entries')} and the team (${plural(data.members.length, 'person', 'people')})`],
    ['formulations', `- Formulations ${as('formulations')}: ${plural(families, 'formulation')} with ${plural(data.formulations.length, 'iteration')}, one file per formulation`
      + `${choices.formulations === 'xlsx' ? ' and one tab per iteration' : ' and a section per iteration'}: ingredients, process steps, calculated nutrition, notes and production log`],
    ['suppliers', `- Suppliers and ingredients ${as('suppliers')}: ${plural(data.suppliers.length, 'supplier')}, the ingredients they supply, and all ${plural(data.ingredients.length, 'ingredient')} with nutrient values, allergens, certifications and costs; equipment; ${plural(data.intake.length, 'lab intake item')}`],
    ['sousChef', `- Sous Chef ${as('sousChef')}: ${plural(data.conversations.length, 'of your own conversations', 'of your own conversations')} (other people's are private to them) and ${plural(data.notebook.length, 'lab notebook note')}`],
    ['nfp', `- Nutrition Facts panels ${as('nfp')}: ${plural(panels, 'panel')}: each saved panel as saved, and a standard panel for each iteration with nutrient data but no saved panel. They are drawn and added by your browser as the zip downloads; if this zip has no Nutrition Facts folder, export again`],
    ['documents', `- Ingredient documents: ${plural(docs, 'uploaded spec sheet or COA', 'uploaded spec sheets and COAs')}, in their original format`],
  ]
  const skipped = parts.filter(([k]) => choices[k] === 'skip').map(([k]) => `- ${EXPORT_CATEGORIES[k].label}`)
  const lines = [
    'Benchtop account export',
    '=======================',
    '',
    `Account: ${data.accountName}`,
    `Exported: ${clock.dateTime(data.generatedAt)}${data.userEmail ? ` by ${data.userEmail}` : ''}`,
    '',
    'What is included',
    '----------------',
    ...parts.filter(([k]) => choices[k] !== 'skip').map(([, line]) => line),
    ...(skipped.length ? ['', 'Skipped (not in this export)', '----------------------------', ...skipped] : []),
    '',
    "Nutrition for formulations is calculated from the ingredients' nutrient values after process losses and",
    "staged additions, and costs from each ingredient's formulation cost, the same way the formulation editor",
    'shows them. Nutrition Facts panels are drawn as the editor draws them.',
    '',
    'A machine-readable JSON copy of the account is available separately from Settings > Privacy & Terms.',
  ]
  if (leftOutDocs.length) {
    lines.push('', 'Documents left out to keep the export downloadable', '--------------------------------------------------',
      'With every spec sheet and COA the zip would be too large to download, so these are listed in the export but not',
      'included. Open them from each ingredient in Benchtop.', ...leftOutDocs.map(d => `- ${d}`))
  }
  if (missingDocs.length) {
    lines.push('', 'Documents that could not be included', '------------------------------------', ...missingDocs.map(d => `- ${d}`))
  }
  return lines.join('\r\n') + '\r\n'
}
