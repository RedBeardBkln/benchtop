import { describe, expect, it } from 'vitest'
import {
  duplicateIngredients, lineGrams, linesToSave, matchByName, matchIngredient, missingInfo, nameScore,
  type ImportDraft, type ImportLine, type LibraryIngredient,
} from './formulation-import'

const ID = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`

const line = (over: Partial<ImportLine> = {}): ImportLine => ({
  key: Math.random().toString(36).slice(2),
  rawName: 'Oats', rawQuantity: '500 g', amount: 500, unit: 'g',
  supplier: null, itemCode: null, note: null,
  ingredientId: ID(1), ingredientName: 'Oats', candidates: [], status: 'matched',
  ...over,
})

const draft = (over: Partial<ImportDraft> = {}): ImportDraft => ({
  fileName: 'bar.xlsx', sheet: null, name: 'Oat Bar', servingSizeG: 40, batchSizeG: null, notes: null,
  client: { rawName: null, id: null, skipped: false },
  project: { rawName: 'Bars', id: ID(9), skipped: false },
  lines: [line()], steps: [], warnings: [],
  ...over,
})

describe('nameScore', () => {
  it('treats case and punctuation as the same name', () => {
    expect(nameScore('Whey Protein Isolate', 'whey-protein  isolate')).toBe(1)
  })
  it('scores a name contained in a longer one highly but below exact', () => {
    const s = nameScore('Whey Protein Isolate', 'Whey Protein Isolate 90 (Acme)')
    expect(s).toBeGreaterThanOrEqual(0.75)
    expect(s).toBeLessThan(1)
  })
  it('scores unrelated names low', () => {
    expect(nameScore('Cocoa Powder', 'Sea Salt')).toBe(0)
  })
})

describe('matchIngredient', () => {
  const library = [
    { id: ID(1), name: 'Rolled Oats' },
    { id: ID(2), name: 'Whey Protein Isolate', itemCode: 'WPI-90' },
    { id: ID(3), name: 'Whey Protein Concentrate' },
  ]
  it('links an exact name', () => {
    expect(matchIngredient({ name: 'rolled oats' }, library).ingredient?.id).toBe(ID(1))
  })
  it('links an item code even when the name differs', () => {
    expect(matchIngredient({ name: 'WPI', itemCode: 'wpi-90' }, library).ingredient?.id).toBe(ID(2))
  })
  it('only suggests close names, best first', () => {
    const r = matchIngredient({ name: 'Whey Protein' }, library)
    expect(r.ingredient).toBeNull()
    expect(r.candidates.map(c => c.id)).toContain(ID(2))
    expect(r.candidates.map(c => c.id)).toContain(ID(3))
  })
  it('suggests nothing for an unknown ingredient', () => {
    expect(matchIngredient({ name: 'Saffron' }, library)).toEqual({ ingredient: null, candidates: [] })
  })
})

describe('matchIngredient: same name written differently', () => {
  const library: LibraryIngredient[] = [
    { id: ID(1), name: 'Sugar, Granulated' },
    { id: ID(2), name: 'Whey Protein Isolate', itemCode: 'WPI-90' },
    { id: ID(3), name: 'Rolled Oats' },
  ]
  const linked = (name: string, lib = library) => matchIngredient({ name }, lib).ingredient?.id

  it('links an exact name', () => {
    expect(linked('Sugar, Granulated')).toBe(ID(1))
  })
  it('links case, punctuation and whitespace variants', () => {
    for (const name of ['sugar granulated', 'SUGAR,  GRANULATED', 'Sugar, Granulated ', 'Sugar, Granulated', 'Sugar (Granulated)']) {
      expect(linked(name), name).toBe(ID(1))
    }
  })
  it('links a different word order when it is the only exact-score match', () => {
    expect(linked('Granulated Sugar')).toBe(ID(1))
  })
  // USDA rows are plural ("Sugars, Granulated"); a sheet usually says "Sugar, Granulated"
  it('links a singular sheet name to a plural library name', () => {
    const lib = [{ id: ID(1), name: 'Sugars, Granulated' }, { id: ID(4), name: 'Sugar, Invert', labelName: 'Sugar' }, ...library.slice(1)]
    expect(linked('Sugar, Granulated', lib)).toBe(ID(1))
    expect(linked('Strawberry', [{ id: ID(1), name: 'Strawberries' }])).toBe(ID(1))
  })
  it('does not auto-link two ingredients with the same name, but suggests both', () => {
    const r = matchIngredient({ name: 'Sugar, Granulated' }, [...library, { id: ID(5), name: 'sugar granulated', supplierName: 'Domino' }])
    expect(r.ingredient).toBeNull()
    expect(r.candidates.map(c => c.id).slice(0, 2).sort()).toEqual([ID(1), ID(5)].sort())
  })
  it('treats a label name like a name, so a matching label name also makes it ambiguous', () => {
    const r = matchIngredient({ name: 'Sugar, Granulated' }, [...library, { id: ID(5), name: 'Cane Sugar EC', labelName: 'Sugar, Granulated' }])
    expect(r.ingredient).toBeNull()
    expect(r.candidates.map(c => c.id)).toEqual(expect.arrayContaining([ID(1), ID(5)]))
  })
  it('falls back to the name when the item code matches nothing', () => {
    expect(matchIngredient({ name: 'Sugar, Granulated', itemCode: 'SUG-001' }, library).ingredient?.id).toBe(ID(1))
  })
  it('falls back to the name when a shared item code has no matching supplier', () => {
    const lib = [...library, { id: ID(5), name: 'Dextrose', itemCode: 'WPI-90', supplierName: 'Beta' }]
    expect(matchIngredient({ name: 'Sugar, Granulated', itemCode: 'WPI-90', supplier: 'Gamma' }, lib).ingredient?.id).toBe(ID(1))
  })
})

describe('matchByName', () => {
  it('matches one record by name and refuses an ambiguous one', () => {
    expect(matchByName('acme foods', [{ id: ID(1), name: 'Acme Foods' }])?.id).toBe(ID(1))
    expect(matchByName('Acme', [{ id: ID(1), name: 'Acme' }, { id: ID(2), name: 'ACME' }])).toBeNull()
    expect(matchByName(null, [{ id: ID(1), name: 'Acme' }])).toBeNull()
  })
})

describe('lineGrams', () => {
  it('converts mass units', () => {
    expect(lineGrams({ amount: 1.5, unit: 'kg' }, null)).toBe(1500)
    expect(lineGrams({ amount: 250, unit: 'mg' }, null)).toBeCloseTo(0.25)
    expect(lineGrams({ amount: 1, unit: 'lb' }, null)).toBeCloseTo(453.59237)
  })
  it('needs a batch size for percentages', () => {
    expect(lineGrams({ amount: 12.5, unit: '%' }, null)).toBeNull()
    expect(lineGrams({ amount: 12.5, unit: '%' }, 2000)).toBe(250)
  })
  it('has no grams without an amount or unit', () => {
    expect(lineGrams({ amount: null, unit: 'g' }, null)).toBeNull()
    expect(lineGrams({ amount: 5, unit: null }, null)).toBeNull()
  })
})

describe('missingInfo', () => {
  it('is complete for a matched, weighed formula in a project', () => {
    expect(missingInfo(draft()).vital).toEqual([])
  })
  it('makes a skipped ingredient or project vital', () => {
    const d = draft({
      project: { rawName: 'Bars', id: null, skipped: true },
      lines: [line(), line({ status: 'skipped', ingredientId: null })],
    })
    const v = missingInfo(d).vital
    expect(v).toContain('Project (skipped)')
    expect(v.some(x => x.startsWith('1 ingredient not linked') && x.includes('1 skipped'))).toBe(true)
  })
  it('ignores excluded rows', () => {
    expect(missingInfo(draft({ lines: [line(), line({ status: 'excluded', ingredientId: null, amount: null })] })).vital).toEqual([])
  })
  it('needs a batch size when amounts are percentages', () => {
    const d = draft({ lines: [line({ amount: 60, unit: '%' }), line({ ingredientId: ID(2), amount: 40, unit: '%' })] })
    expect(missingInfo(d).vital).toEqual(['Batch size (needed to turn percentages into grams)'])
    expect(missingInfo({ ...d, batchSizeG: 1000 }).vital).toEqual([])
  })
  it('flags percentages that do not add up as optional', () => {
    const d = draft({
      batchSizeG: 1000,
      lines: [line({ amount: 60, unit: '%' }), line({ ingredientId: ID(2), amount: 30, unit: '%' })],
    })
    const m = missingInfo(d)
    expect(m.vital).toEqual([])
    expect(m.optional.some(o => o.includes('90%'))).toBe(true)
  })
  it('mentions the file’s client only while a new project still has to be made', () => {
    const client = { rawName: 'Acme', id: null, skipped: false }
    expect(missingInfo(draft({ client, project: { rawName: 'Bars', id: null, skipped: false } })).optional).toContain('Client “Acme”')
    expect(missingInfo(draft({ client })).optional).not.toContain('Client “Acme”')
    expect(missingInfo(draft({ client: { ...client, skipped: true }, project: { rawName: null, id: null, skipped: false } })).optional)
      .not.toContain('Client “Acme”')
  })
})

describe('linesToSave', () => {
  it('combines rows that link to the same ingredient', () => {
    const d = draft({ lines: [line({ amount: 1, unit: 'kg' }), line({ amount: 250, unit: 'g' }), line({ ingredientId: ID(2), amount: 50, unit: 'g' })] })
    expect(linesToSave(d)).toEqual([{ ingredientId: ID(1), weightG: 1250 }, { ingredientId: ID(2), weightG: 50 }])
    expect(duplicateIngredients(d)).toEqual(['Oats'])
  })
  it('refuses while anything vital is missing', () => {
    expect(linesToSave(draft({ project: { rawName: null, id: null, skipped: false } }))).toBeNull()
  })
})
