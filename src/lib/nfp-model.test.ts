import { describe, expect, it } from 'vitest'
import type { NutrientResult } from './formulation-calc'
import { buildNfpModel, nfpModelSchema } from './nfp-model'

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
