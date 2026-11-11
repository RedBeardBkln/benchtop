import { describe, expect, it } from 'vitest'
import { calcNutrientProfile } from '@/lib/formulation-calc'
import { computeCogs } from '@/lib/costing'
import { buildNfpModel } from '@/lib/nfp-model'
import type { ExportData, ExportFormulation, ExportIngredient } from './data'
import { assignDocPaths, buildExportFiles, buildReadme, makeClock, markdownBlocks, panelJobs, pathAllocator, safeName } from './build'
import { DEFAULT_CHOICES, type SectionSheet, type Sheet } from './model'
import { pdfSafe } from './pdf-text'

const at = new Date('2026-11-11T20:30:00Z')
const ACCOUNT = 'acct-1'

// Benchtop rows carry many columns the export doesn't read; the fixture fills what it does and casts the rest
const row = <T,>(fields: Partial<T>) => fields as T
const loose = (fields: object): never => fields as never

function fixture(): ExportData {
  const steps = [{ id: 's1', lossType: 'moisture', lossAmount: 5, lossUnit: 'pct' }]
  const calc = calcNutrientProfile({
    lines: [
      { ingredientId: 'i1', weightG: 600, nutrients: [{ nutrientId: 'n1', amountPer100g: 80 }] },
      // Added after the bake step: it skips the moisture loss
      { ingredientId: 'i2', weightG: 400, nutrients: [], addedAfterStepId: 's1' },
    ],
    allNutrients: [{ id: 'n1', name: 'Protein', unit: 'g', category: 'macros', dailyValueAmount: 50 }],
    servingSizeG: 50,
    steps,
  })
  const cogs = computeCogs({
    lines: [{ key: 'l1', ingredientId: 'i1', name: 'Whey', weightG: 600 }, { key: 'l2', ingredientId: 'i2', name: 'Water', weightG: 400 }],
    // Whey's cost comes from the supplier price marked "use for cost": $240 per 25 kg = $9.60/kg
    costPerKg: id => (id === 'i1' ? 9.6 : null),
    finishedWeightG: calc.processYield.finishedWeightG,
    servingSizeG: 50,
    unitSizeG: 100,
  })
  const base = row<ExportFormulation>({
    accountId: ACCOUNT, projectId: 'p1', familyId: 'fam1', parentFormulationId: null, mode: 'ground_up',
    servingSizeG: '50', unitSizeG: '100', batchSizeG: '1000', batchLocked: false, notes: null, iterationNote: null,
    lockedAt: null, archivedAt: null, iterationArchivedAt: null, createdAt: at, updatedAt: at, projectName: 'Protein Bar',
    lines: [
      loose({ id: 'l1', formulationId: 'f1', ingredientId: 'i1', position: 1, weightG: '600', pct: '60', minPct: null, maxPct: null, locked: false, pctLocked: false, stagePct: null, addedAfterStepId: null, ingredientName: 'Whey', addedAfterStep: null }),
      loose({ id: 'l2', formulationId: 'f1', ingredientId: 'i2', position: 2, weightG: '400', pct: '40', minPct: null, maxPct: null, locked: false, pctLocked: false, stagePct: '40', addedAfterStepId: 's1', ingredientName: 'Water', addedAfterStep: 1 }),
    ],
    steps: [loose({ id: 's1', formulationId: 'f1', stepNo: 1, instruction: 'Bake', params: { temp_c: '180' }, lossType: 'moisture', lossAmount: '5', lossUnit: 'pct', equipmentId: null, equipmentName: 'Oven' })],
    iterationNotes: [], targets: [], batchRuns: [], nfpPanels: [], calc, cogs,
  })
  const v1: ExportFormulation = { ...base, id: 'f0', name: 'Bar', version: 1, status: 'draft' }
  const v2: ExportFormulation = {
    ...base, id: 'f1', name: 'Bar', version: 2, status: 'locked', lockedAt: at,
    iterationNotes: [loose({ id: 'fn1', formulationId: 'f1', userId: 'u1', authorEmail: 'a@b.co', body: 'Too dry', createdAt: at, updatedAt: at })],
    nfpPanels: [loose({
      id: 'np1', formulationId: 'f1', name: 'Retail label', rulesVersion: 'test', servingSizeG: '40', createdAt: at,
      model: buildNfpModel({ servingSizeG: 40, servingsPerContainer: 10, results: calc.results }),
    })],
  }
  const ing = (id: string, name: string, extra: Partial<ExportIngredient> = {}): ExportIngredient => row<ExportIngredient>({
    id, accountId: ACCOUNT, name, sourceType: 'manual', fdcId: null, verification: 'verified', isAbSpi: false,
    isIsolateOrConcentrate: false, naturallyDerived: true, defaultCostPerKg: null, costUnit: 'kg', moisturePct: null,
    densityGPerMl: null, stockG: null, labelName: null, brandName: null, supplierName: null, itemCode: null, notes: null,
    category: null, subcategory: null, microCategory: null, onHand: true, archivedAt: null, createdAt: at, updatedAt: at,
    nutrients: [], allergens: [], certs: [], subIngredients: [], suppliers: [], docs: [], cost: null, ...extra,
  })
  return {
    generatedAt: at, accountName: 'Acme Labs', userEmail: 'owner@acme.test',
    clients: [{
      ...row<ExportData['clients'][number]>({
        id: 'c1', accountId: ACCOUNT, name: 'Acme', website: 'acme.test', legalName: 'Acme Foods LLC', paymentTerms: 'Net 30',
        poRequired: true, billingEmail: 'ap@acme.test', billingAddress: { line1: '1 Main St', line2: '', city: 'Denver', region: 'CO', postalCode: '80202', country: 'US' },
        otherCarrierAccounts: [], archivedAt: null, createdAt: at, updatedAt: at,
      }),
      contacts: [loose({ id: 'cc1', clientId: 'c1', name: 'Pat Lee', title: 'R&D', email: 'pat@acme.test', phone: null, isPrimary: true, notes: null })],
    }],
    projects: [loose({ id: 'p1', accountId: ACCOUNT, clientId: 'c1', name: 'Protein Bar', client: 'Acme', objectiveText: null, proteinTargetPct: null, targets: [], requiredCerts: [], excludedAllergens: [], status: 'active', createdAt: at, updatedAt: at })],
    formulations: [v1, v2],
    ingredients: [
      ing('i1', 'Whey', {
        cost: { perKg: 9.6, source: 'supplier', supplierName: 'Bulk Co', linkId: 'is1' },
        suppliers: [loose({ id: 'is1', ingredientId: 'i1', supplierId: 's1', packSize: '25', packUnit: 'kg', costPerUnit: '240', useForCost: true, isPreferred: true, notes: null, supplierName: 'Bulk Co' })],
        docs: [loose({ id: 'd1', ingredientId: 'i1', filePath: 'i1/1-spec.pdf', label: 'Spec Sheet', uploadedAt: at })],
      }),
      ing('i2', 'Water'),
    ],
    suppliers: [{
      ...row<ExportData['suppliers'][number]>({ id: 's1', accountId: ACCOUNT, name: 'Bulk Co', websiteUrl: null, email: 'sales@bulk.test', phone: null, address: null, accountNumber: 'A-9', paymentTerms: null, notes: null, archivedAt: null, createdAt: at, updatedAt: at }),
      contacts: [loose({ id: 'sc1', supplierId: 's1', name: 'Sam', title: 'Sales', email: null, phone: '555-0100', isPrimary: true, notes: null })],
    }],
    equipment: [],
    intake: [loose({ id: 'in1', accountId: ACCOUNT, rawName: 'WPC 80 bag', quantity: '2', quantityUnit: 'kg', status: 'imported', name: 'Whey protein concentrate', category: 'Proteins', createdAt: at, ingredientName: 'Whey' })],
    timeEntries: [loose({
      id: 't1', accountId: ACCOUNT, userId: 'u1', clientId: 'c1', projectId: 'p1', activity: 'research', task: 'Shelf-life literature',
      startedAt: new Date('2026-11-10T14:00:00Z'), endedAt: new Date('2026-11-10T15:30:00Z'), billed: false, billedAt: null, billedRef: null,
      clientName: 'Acme', projectName: 'Protein Bar', userName: 'Owner Person',
    })],
    members: [{ userId: 'u1', role: 'owner', name: 'Owner Person', email: 'owner@acme.test', joinedAt: at }],
    notebook: [loose({ id: 'nb1', accountId: ACCOUNT, createdBy: 'u1', kind: 'learning', content: 'Whey ≥ 20% gets dry', projectId: 'p1', formulationId: null, conversationId: null, retiredAt: null, createdAt: at, updatedAt: at, createdByName: 'Owner Person', projectName: 'Protein Bar', formulationLabel: null })],
    conversations: [{
      ...row<ExportData['conversations'][number]>({ id: 'conv1', accountId: ACCOUNT, userId: 'u1', title: 'Dry bar', projectId: 'p1', formulationFamilyId: null, formulationId: null, createdAt: at, updatedAt: at, linkedTo: 'Protein Bar' }),
      messages: [
        loose({ id: 'm1', conversationId: 'conv1', role: 'user', content: 'Why is it dry?', activity: [], createdAt: at }),
        loose({ id: 'm2', conversationId: 'conv1', role: 'assistant', content: '## Causes\n- **Whey** binds water\n- Low glycerin', activity: ['Read a formulation'], createdAt: at }),
      ],
    }],
  }
}

const isTable = (s: Sheet | SectionSheet | undefined): s is Sheet => !!s && !('sections' in s)

describe('helpers', () => {
  it('makes safe, unique file names', () => {
    expect(safeName('Bar: Mk/II?')).toBe('Bar- Mk-II-')
    expect(safeName('Aux')).toBe('Aux_')
    const alloc = pathAllocator()
    expect([alloc('a/Spec', 'pdf'), alloc('a/spec', 'pdf')]).toEqual(['a/Spec.pdf', 'a/spec (2).pdf'])
    expect(assignDocPaths(fixture().ingredients).get('d1')).toBe('Ingredient documents/Whey/Spec Sheet.pdf')
  })
  it("shows times in the exporter's zone", () => {
    expect(makeClock('America/New_York').wall(at)!.toISOString()).toBe('2026-11-11T15:30:00.000Z')
  })
  it('keeps Markdown structure and makes text safe for PDF fonts', () => {
    expect(markdownBlocks('- **a** b')).toEqual([{ t: 'bullets', numbered: false, items: ['a b'] }])
    expect(pdfSafe('β-glucan ≥ 5 µg 🎉')).toBe('beta-glucan >= 5 µg ')
  })
})

describe('buildExportFiles', () => {
  const data = fixture()
  const clock = makeClock('UTC')
  const files = buildExportFiles(data, clock, assignDocPaths(data.ingredients), DEFAULT_CHOICES)
  const book = (path: string) => {
    const f = files.find(f => f.kind === 'workbook' && f.book.path === path)
    if (!f || f.kind !== 'workbook') throw new Error(`no workbook ${path}`)
    return f.book
  }
  const sheet = (path: string, name: string) => {
    const s = book(path).sheets.find(s => s.name === name)
    if (!isTable(s)) throw new Error(`no table sheet ${name}`)
    return Object.assign(s, { col: (label: string, r = 0) => s.rows[r][s.columns.findIndex(c => c.label === label)] })
  }

  it('writes the default formats', () => {
    expect(files.map(f => (f.kind === 'workbook' ? `${f.book.path}.xlsx` : `${f.report.path}.${f.format}`))).toEqual([
      'Projects and clients.xlsx', 'Formulations/Protein Bar/Bar.xlsx', 'Suppliers and ingredients.xlsx',
      'Sous Chef/Conversations.pdf', 'Sous Chef/Lab notebook.pdf',
    ])
  })

  it('includes client records with contacts, time entries and the team', () => {
    const clients = sheet('Projects and clients', 'Clients')
    expect(clients.col('Client')).toBe('Acme')
    expect(clients.col('Projects')).toBe('Protein Bar')
    expect(clients.col('Billing address')).toBe('1 Main St, Denver CO 80202, US')
    expect(clients.col('PO required')).toBe('Yes')
    expect(sheet('Projects and clients', 'Client contacts').rows).toEqual([['Acme', 'Pat Lee', 'R&D', 'pat@acme.test', null, 'Yes', null]])
    const time = sheet('Projects and clients', 'Time entries')
    expect(time.col('Hours')).toBe(1.5)
    expect(time.col('Activity')).toBe('Research')
    expect(time.col('Billed')).toBe('No')
    expect(sheet('Projects and clients', 'Team').rows).toEqual([['Owner Person', 'owner@acme.test', 'Owner', at]])
  })

  it('costs and stages lines as the editor does, one tab per iteration', () => {
    const tabs = book('Formulations/Protein Bar/Bar').sheets
    expect(tabs.map(s => s.name)).toEqual(['v1', 'v2'])
    const v2 = tabs[1] as SectionSheet
    const fields = v2.sections.find(s => s.t === 'fields')
    const field = (label: string) => (fields?.t === 'fields' ? fields.fields.find(f => f[0] === label)?.[1] : undefined)
    expect(field('Batch cost ($)')).toBeCloseTo(5.76) // 0.6 kg × $9.60 from the supplier price
    expect(field('Cost per unit ($)')).toBeGreaterThan(0)
    const lines = v2.sections.find(s => s.t === 'table' && s.title === 'Ingredients')
    if (lines?.t !== 'table') throw new Error('no ingredients table')
    const col = (label: string, r: number) => lines.rows[r][lines.columns.findIndex(c => c.label === label)]
    expect(col('Cost per kg ($)', 0)).toBeCloseTo(9.6)
    expect(col('Added after step', 1)).toBe(1)
    expect(col('Stage %', 1)).toBe(40)
    const panels = v2.sections.find(s => s.t === 'table' && s.title === 'Saved Nutrition Facts panels')
    expect(panels?.t === 'table' && panels.rows[0][0]).toBe('Retail label')
  })

  it('groups suppliers, their contacts and ingredients with all ingredients and lab intake', () => {
    expect(book('Suppliers and ingredients').sheets.map(s => s.name)).toEqual([
      'Suppliers', 'Supplier contacts', 'Supplier ingredients', 'All ingredients', 'Nutrition per 100 g',
      'Nutrient values and sources', 'Documents', 'Lab intake', 'Equipment',
    ])
    expect(sheet('Suppliers and ingredients', 'Supplier ingredients').col('Used for cost')).toBe('Yes')
    const all = sheet('Suppliers and ingredients', 'All ingredients')
    expect(all.col('Formulation cost per kg ($)')).toBeCloseTo(9.6)
    expect(all.col('Cost from')).toBe('Supplier price (Bulk Co)')
    expect(sheet('Suppliers and ingredients', 'Lab intake').col('Library ingredient')).toBe('Whey')
  })

  it('writes Word or PDF documents when chosen', () => {
    const docs = buildExportFiles(data, clock, assignDocPaths(data.ingredients), { ...DEFAULT_CHOICES, projects: 'pdf', formulations: 'docx', suppliers: 'pdf' })
    const projects = docs.find(d => d.kind === 'report' && d.report.path === 'Projects and clients')
    if (projects?.kind !== 'report') throw new Error('no projects report')
    expect(projects.report.blocks.flatMap(b => (b.t === 'h1' ? [b.text] : []))).toEqual(['Clients', 'Projects', 'Time entries', 'Team'])
    const f = docs.find(d => d.kind === 'report' && d.report.path.startsWith('Formulations/'))
    if (f?.kind !== 'report') throw new Error('no formulation report')
    const lines = f.report.blocks.find(b => b.t === 'table')
    expect(lines?.t === 'table' && lines.rows[1][1]).toBe('Water (added after step 1)')
    expect(lines?.t === 'table' && lines.rows[0][4]).toBe('$9.60')
  })
})

describe('panelJobs', () => {
  it("exports each saved panel as saved, and a standard panel for iterations that don't have one", () => {
    const jobs = panelJobs(fixture(), 'png')
    expect(jobs.map(j => j.path)).toEqual([
      'Nutrition Facts/Protein Bar/Bar v1.png',
      'Nutrition Facts/Protein Bar/Bar v2 - Retail label.png',
    ])
    const f = fixture().formulations[0]
    expect(jobs[0].model).toEqual(buildNfpModel({
      servingSizeG: 50,
      servingsPerContainer: f.calc.processYield.finishedWeightG / 50,
      results: f.calc.results,
    }))
    expect(jobs[1].model).toEqual(fixture().formulations[1].nfpPanels[0].model)
  })
  it('falls back to a standard panel when no saved panel can be read', () => {
    const data = fixture()
    data.formulations[1].nfpPanels[0].model = { broken: true }
    expect(panelJobs(data, 'pdf').map(j => j.path)).toEqual(['Nutrition Facts/Protein Bar/Bar v1.pdf', 'Nutrition Facts/Protein Bar/Bar v2.pdf'])
  })
})

describe('buildReadme', () => {
  it('names the account and counts what was exported', () => {
    const text = buildReadme({ data: fixture(), clock: makeClock('UTC'), choices: DEFAULT_CHOICES, panels: 2, missingDocs: [] })
    expect(text).toContain('Benchtop account export')
    expect(text).toContain('Account: Acme Labs')
    expect(text).toContain('1 time entry and the team (1 person)')
    expect(text).toContain('1 lab intake item')
    expect(text).not.toContain('Formul8')
  })
})

describe('buildExportArchive', () => {
  it('leaves out documents that would take the zip past its budget, and says so in the README', async () => {
    const { buildExportArchive } = await import('./archive')
    const JSZip = (await import('jszip')).default
    const data = fixture()
    // Word for Sous Chef keeps the PDF renderer out of the test
    const choices = { ...DEFAULT_CHOICES, sousChef: 'docx' as const }
    const run = (budgetBytes: number) => buildExportArchive({
      data, choices, clock: makeClock('UTC'), dateStamp: '2026-11-11', budgetBytes,
      fetchDoc: async () => new Uint8Array(400_000),
    })
    const files = async (bytes: Buffer) => Object.keys((await JSZip.loadAsync(bytes)).files).filter(f => f.includes('Ingredient documents/') && !f.endsWith('/'))

    const roomy = await run(50_000_000)
    expect(await files(roomy.bytes)).toHaveLength(data.ingredients.reduce((n, i) => n + i.docs.length, 0))

    const tight = await run(100_000)
    expect(await files(tight.bytes)).toEqual([])
    const readme = await (await JSZip.loadAsync(tight.bytes)).file(`${tight.root}/README.txt`)!.async('string')
    expect(readme).toContain('Documents left out to keep the export downloadable')
    expect(readme).toContain('- Whey: Spec Sheet')
  })
})
