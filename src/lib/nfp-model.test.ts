import { describe, expect, it } from 'vitest'
import type { NutrientResult } from './formulation-calc'
import {
  abbreviate, allergenBody, buildNfpModel, defaultHouseholdMeasure, nfpModelSchema, nfpOptionsSchema, splitTabularRows, sugarCarbIssues,
} from './nfp-model'

const n = (name: string, unit: string, perServing: number, dv: number | null = null, category = 'macros'): NutrientResult => ({
  nutrientId: name, name, unit, category, perFinished100g: perServing * 2, perServing, dailyValueAmount: dv,
})

const results: NutrientResult[] = [
  n('Energy', 'kcal', 47),
  n('Total Fat', 'g', 3.27, 78),
  n('Saturated Fat', 'g', 0.3, 20),
  n('Trans Fat', 'g', 0),
  n('Polyunsaturated Fat', 'g', 0.2),
  n('Cholesterol', 'mg', 3, 300),
  n('Sodium', 'mg', 137, 2300, 'minerals'),
  n('Total Carbohydrate', 'g', 27.4, 275),
  n('Dietary Fiber', 'g', 0.7, 28),
  n('Total Sugars', 'g', 12.5),
  n('Added Sugars', 'g', 0.2, 50),
  n('Protein', 'g', 4.6),
  n('Vitamin D', 'mcg', 2.46, 20, 'vitamins'),
  n('Calcium', 'mg', 134, 1300, 'minerals'),
  n('Iron', 'mg', 0.74, 18, 'minerals'),
  n('Potassium', 'mg', 234, 4700, 'minerals'),
]

const build = (over: Partial<Parameters<typeof buildNfpModel>[0]> = {}) =>
  buildNfpModel({ servingSizeG: 30.4, servingsPerContainer: 3.3, results, ...over })

describe('buildNfpModel', () => {
  const m = build()
  const row = (k: string) => m.rows.find(r => r.key === k)!

  it('applies the FDA rounding rules to every declared value', () => {
    expect(m.calories).toBe('45') // 47 cal → nearest 5
    expect(row('Total Fat').amount).toBe('3.5g')
    expect(row('Saturated Fat').amount).toBe('0g')
    expect(row('Cholesterol').amount).toBe('<5mg')
    expect(row('Sodium').amount).toBe('135mg')
    expect(row('Total Carbohydrate').amount).toBe('27g')
    expect(row('Dietary Fiber').amount).toBe('<1g')
    expect(row('Total Sugars').amount).toBe('13g')
    expect(row('Added Sugars').amount).toBe('0g')
    expect(row('Protein').amount).toBe('5g')
    expect(row('Vitamin D').amount).toBe('2.5mcg')
    expect(row('Calcium').amount).toBe('130mg')
    expect(row('Iron').amount).toBe('0.7mg')
    expect(row('Potassium').amount).toBe('230mg')
    expect(m.servingSizeText).toBe('30g')
    expect(m.servingsText).toBe('about 3.5 servings per container')
  })

  it('computes %DV from the unrounded amount, with vitamin/mineral tiers', () => {
    expect(row('Total Fat').dvPct).toBe('4%')          // 3.27/78 = 4.19%
    expect(row('Sodium').dvPct).toBe('6%')             // 137/2300 = 5.96%
    expect(row('Vitamin D').dvPct).toBe('10%')         // 12.3% → nearest 5
    expect(row('Calcium').dvPct).toBe('10%')           // 10.3% → nearest 5
    expect(row('Iron').dvPct).toBe('4%')               // 4.1% → nearest 2
    expect(row('Trans Fat')?.dvPct).toBeUndefined()
  })

  it('records the rule that produced each value, for the hover explanation', () => {
    const fat = row('Total Fat').amountRule!
    expect(fat.ruleId).toBe('fat')
    expect(fat.citation).toContain('101.9(c)(2)')
    expect(fat.actual).toBe('3.27 g')
    expect(fat.declared).toBe('3.5 g')
    expect(fat.applied).toContain('0.5 to under 5 g → nearest 0.5 g')
    expect(row('Calcium').dvRule!.ruleId).toBe('dv-vitamin-mineral')
    expect(row('Total Fat').dvRule!.ruleId).toBe('dv-whole')
    expect(m.caloriesRule.ruleId).toBe('calories')
    expect(m.servingSizeRule?.ruleId).toBe('serving-size')
    expect(m.servingsRule?.ruleId).toBe('servings-per-container')
  })

  it('drops voluntary fats that declare as zero but keeps mandatory rows', () => {
    expect(m.rows.find(r => r.key === 'Polyunsaturated Fat')).toBeUndefined() // 0.2 g → 0
    expect(m.rows.find(r => r.key === 'Trans Fat')).toBeDefined()
  })

  it('hideZeros removes rows that round to zero, not rows that merely print "<"', () => {
    const h = build({ hideZeros: true })
    expect(h.rows.find(r => r.key === 'Trans Fat')).toBeUndefined()
    expect(h.rows.find(r => r.key === 'Saturated Fat')).toBeUndefined() // 0.3 g → 0
    expect(h.rows.find(r => r.key === 'Cholesterol')).toBeDefined()      // "<5mg"
    expect(h.rows.find(r => r.key === 'Dietary Fiber')).toBeDefined()    // "<1g"
  })

  it('falls back to per-100g with an explanatory note when there is no serving size', () => {
    const p = build({ servingSizeG: undefined, servingsPerContainer: undefined })
    expect(p.perServing).toBe(false)
    expect(p.basisLabel).toBe('Amount per 100g')
    expect(p.servingSizeText).toBe('100g')
    expect(p.servingsText).toBe('Servings per container variable')
    expect(p.rows.find(r => r.key === 'Total Fat')!.amountRule!.applied).toContain('No serving size is set')
  })

  it('applies vitamin/mineral %DV tiers to voluntary extras and flags their display rule', () => {
    const e = build({
      extras: [
        { name: 'Vitamin C', value: 27, unit: 'mg', category: 'vitamins', dailyValue: 90 },
        { name: 'Choline', value: 55, unit: 'mg', category: 'other', dailyValue: 550 },
      ],
    })
    const c = e.rows.find(r => r.key === 'extra:Vitamin C')!
    expect(c.amount).toBe('27mg')
    expect(c.dvPct).toBe('30%')                       // 30% → nearest 5
    expect(c.dvRule!.ruleId).toBe('dv-vitamin-mineral')
    expect(c.amountRule!.ruleId).toBe('voluntary-display')
    expect(e.rows.find(r => r.key === 'extra:Choline')!.dvRule!.ruleId).toBe('dv-whole')
  })

  it('produces JSON that satisfies the persistence schema and survives a round trip', () => {
    const parsed = nfpModelSchema.safeParse(JSON.parse(JSON.stringify(build({ allergenStatement: 'Milk', ingredientStatement: 'Oats' }))))
    expect(parsed.success).toBe(true)
  })
})

describe('layouts', () => {
  it('records the chosen layout, standard by default, and old saved panels still validate', () => {
    expect(build().layout).toBe('standard')
    expect(build({ layout: 'tabular' }).layout).toBe('tabular')
    const { layout: _omit, ...legacy } = build()
    void _omit
    expect(nfpModelSchema.safeParse(legacy).success).toBe(true)
    expect(nfpOptionsSchema.parse({}).layout).toBe('standard')
  })

  it('splits the tabular columns at Total Carbohydrate', () => {
    const [left, right] = splitTabularRows(build().rows.filter(r => r.section === 'main'))
    expect(left.at(-1)?.key).toBe('Sodium')
    expect(right[0].key).toBe('Total Carbohydrate')
    expect(right.at(-1)?.key).toBe('Protein')
  })

  it('uses FDA-permitted abbreviations and leaves other labels alone', () => {
    expect(abbreviate('Total Carbohydrate')).toBe('Total Carb.')
    expect(abbreviate('Cholesterol')).toBe('Cholest.')
    expect(abbreviate('Protein')).toBe('Protein')
  })
})

describe('allergenBody', () => {
  it('drops a leading "Contains:" because the panel prints its own', () => {
    expect(allergenBody('Contains: Milk, Wheat.')).toBe('Milk, Wheat.')
    expect(allergenBody('  CONTAINS Milk')).toBe('Milk')
    expect(allergenBody('Milk. May contain peanuts.')).toBe('Milk. May contain peanuts.')
  })
})

describe('sugars within carbohydrate', () => {
  // Greek Yogurt, Mango: the fruit prep's spec lists more sugars than carbohydrate
  const withSugars = (sugars: number, added: number) =>
    results.map(r => (r.name === 'Total Sugars' ? n('Total Sugars', 'g', sugars) : r.name === 'Added Sugars' ? n('Added Sugars', 'g', added, 50) : r.name === 'Total Carbohydrate' ? n('Total Carbohydrate', 'g', 17.39, 275) : r))
  const amount = (m: ReturnType<typeof buildNfpModel>, k: string) => m.rows.find(r => r.key === k)!

  it('never declares more sugars than carbohydrate, and says why', () => {
    const m = buildNfpModel({ servingSizeG: 150, servingsPerContainer: 1, results: withSugars(17.54, 7.7) })
    expect(amount(m, 'Total Carbohydrate').amount).toBe('17g')
    expect(amount(m, 'Total Sugars').amount).toBe('17g')
    expect(amount(m, 'Total Sugars').amountRule!.applied).toContain('more than Total Carbohydrate')
  })

  it('never declares more added sugars than total sugars', () => {
    const m = buildNfpModel({ servingSizeG: 150, servingsPerContainer: 1, results: withSugars(10.2, 12.4) })
    expect(amount(m, 'Added Sugars').amount).toBe('10g')
  })

  it('leaves consistent values alone', () => {
    const m = buildNfpModel({ servingSizeG: 150, servingsPerContainer: 1, results: withSugars(12.5, 7.7) })
    expect(amount(m, 'Total Sugars').amount).toBe('13g')
    expect(amount(m, 'Total Sugars').amountRule!.applied).not.toContain('more than')
  })

  it("doesn't cap sugars when the formulation has no carbohydrate data", () => {
    const m = buildNfpModel({ servingSizeG: 150, servingsPerContainer: 1, results: results.filter(r => r.name !== 'Total Carbohydrate') })
    expect(amount(m, 'Total Sugars').amount).toBe('13g')
  })

  it('names the ingredients whose data has sugars above carbohydrate', () => {
    const lines = [
      { ingredientName: 'White Mass', nutrients: [{ nutrientId: 'Total Carbohydrate', amountPer100g: 7.5 }, { nutrientId: 'Total Sugars', amountPer100g: 7.5 }] },
      { ingredientName: 'Fruit Prep, Mango', nutrients: [{ nutrientId: 'Total Carbohydrate', amountPer100g: 27.95 }, { nutrientId: 'Total Sugars', amountPer100g: 28.42 }, { nutrientId: 'Added Sugars', amountPer100g: 25.03 }] },
      { ingredientName: 'Syrup', nutrients: [{ nutrientId: 'Total Sugars', amountPer100g: 60 }] },
      { ingredientName: 'Collagen', nutrients: [] },
    ]
    expect(sugarCarbIssues(lines, results)).toEqual([
      { ingredientName: 'Fruit Prep, Mango', carbs: 27.95, sugars: 28.42, addedSugars: 25.03 },
      { ingredientName: 'Syrup', carbs: null, sugars: 60, addedSugars: 0 },
    ])
  })
})

describe('serving size and servings per container', () => {
  it('says "serving" for one serving and "servings" for more', () => {
    expect(build({ servingsPerContainer: 1 }).servingsText).toBe('1 serving per container')
    expect(build({ servingsPerContainer: 1.2 }).servingsText).toBe('about 1 serving per container')
    expect(build({ servingsPerContainer: 2 }).servingsText).toBe('2 servings per container')
  })

  it('prints the household measure before the gram weight', () => {
    expect(build({ servingSizeG: 55, householdMeasure: '2/3 cup' }).servingSizeText).toBe('2/3 cup (55g)')
    expect(build({ servingSizeG: 55, householdMeasure: '' }).servingSizeText).toBe('55g')
  })

  it('defaults to "1 container" only when the package is exactly one serving', () => {
    expect(build({ servingSizeG: 150, servingsPerContainer: 1 }).servingSizeText).toBe('1 container (150g)')
    expect(build({ servingSizeG: 150, servingsPerContainer: 1.2 }).servingSizeText).toBe('150g')
    expect(defaultHouseholdMeasure(undefined)).toBe('')
    expect(build({ servingSizeG: 150, servingsPerContainer: 1 }).servingSizeRule!.applied).toContain('household measure')
  })

  it('keeps the household measure with a saved panel’s options', () => {
    expect(nfpOptionsSchema.parse({ householdMeasure: '1 bar' }).householdMeasure).toBe('1 bar')
    expect(nfpOptionsSchema.parse({}).householdMeasure).toBeUndefined()
  })
})

describe('protein %DV', () => {
  const protein = (m: ReturnType<typeof buildNfpModel>) => m.rows.find(r => r.key === 'Protein')!

  it('has no %DV unless a PDCAAS is given', () => {
    expect(protein(build()).dvPct).toBeUndefined()
  })

  it('works the %DV out from PDCAAS-corrected protein against 50 g', () => {
    const results18 = results.map(r => (r.name === 'Protein' ? n('Protein', 'g', 18) : r))
    const whey = build({ results: results18, proteinPdcaas: 1 })
    expect(protein(whey).amount).toBe('18g')  // the amount stays uncorrected
    expect(protein(whey).dvPct).toBe('36%')   // 18 ÷ 50
    expect(protein(whey).dvRule!.applied).toContain('PDCAAS 1')
    const gluten = build({ results: results18, proteinPdcaas: 0.25 })
    expect(protein(gluten).dvPct).toBe('9%')  // 4.5 g corrected ÷ 50 g
  })

  it('keeps the setting with a saved panel’s options', () => {
    expect(nfpOptionsSchema.parse({ proteinDv: true, pdcaas: 0.92 })).toMatchObject({ proteinDv: true, pdcaas: 0.92 })
    expect(nfpOptionsSchema.parse({}).proteinDv).toBe(false)
    expect(nfpOptionsSchema.safeParse({ pdcaas: 1.2 }).success).toBe(false)
  })
})
