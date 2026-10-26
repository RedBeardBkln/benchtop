import { describe, expect, it } from 'vitest'
import { calcNutrientProfile, dryBasisFactor, type CalcNutrient } from './formulation-calc'
import { evaluateTargets, fmtBasis } from './target-validation'
import { solve, type SolverLine } from './solver'
import { parseUsdaWater } from './usda-import'
import type { ProjectTarget } from './types'

const protein: CalcNutrient = { id: 'p', name: 'Protein', unit: 'g', category: 'macros', dailyValueAmount: 50 }

// 600 g milk (3.4% protein, 87% water) + 400 g whey (80% protein, 4% water)
const milk = { ingredientId: 'milk', weightG: 600, nutrients: [{ nutrientId: 'p', amountPer100g: 3.4 }], moisturePct: 87 }
const whey = { ingredientId: 'whey', weightG: 400, nutrients: [{ nutrientId: 'p', amountPer100g: 80 }], moisturePct: 4 }

const dryTarget: ProjectTarget = {
  nutrient: 'Protein', label: 'Protein', comparator: '>=', value: 70, unit: 'g', basis: 'per_100g', dryBasis: true,
}

describe('dry basis', () => {
  it('measures nutrients per 100 g of dry matter', () => {
    const calc = calcNutrientProfile({ lines: [milk, whey], allNutrients: [protein] })
    // Protein 20.4 + 320 = 340.4 g; dry matter 78 + 384 = 462 g
    expect(calc.dryMatterG).toBeCloseTo(462, 6)
    expect(calc.results[0].perFinished100g).toBeCloseTo(34.04, 6)
    const [check] = evaluateTargets([dryTarget], calc.results, undefined, dryBasisFactor(calc))
    expect(check.actual).toBeCloseTo(73.68, 2)
    expect(check.status).toBe('pass')
  })

  it('isn’t changed by drying the batch', () => {
    const steps = [{ lossType: 'moisture' as const, lossAmount: 300, lossUnit: 'g' as const }]
    const calc = calcNutrientProfile({ lines: [milk, whey], allNutrients: [protein], steps })
    const [check] = evaluateTargets([dryTarget], calc.results, undefined, dryBasisFactor(calc))
    expect(check.actual).toBeCloseTo(73.68, 2)
  })

  it('has no data until every ingredient has a moisture %', () => {
    const calc = calcNutrientProfile({ lines: [milk, { ...whey, moisturePct: null }], allNutrients: [protein] })
    expect(calc.dryMatterG).toBeNull()
    expect(calc.missingMoistureIds).toEqual(['whey'])
    const [check] = evaluateTargets([dryTarget], calc.results, undefined, dryBasisFactor(calc))
    expect(check.status).toBe('no-data')
  })

  it('labels the basis', () => {
    expect(fmtBasis(dryTarget)).toBe('/ 100 g dry')
    expect(fmtBasis({ ...dryTarget, dryBasis: undefined })).toBe('/ 100 g')
    expect(fmtBasis({ ...dryTarget, dryBasis: undefined, basis: 'per_serving' })).toBe('/ serving')
  })

  it('solves to a dry-basis target', () => {
    const lines: SolverLine[] = [
      { key: 'milk', ingredientName: 'Milk', weightG: 600, locked: false, minPct: 0, maxPct: 100, moisturePct: 87, nutrients: [{ name: 'Protein', amountPer100g: 3.4 }] },
      { key: 'whey', ingredientName: 'Whey', weightG: 400, locked: false, minPct: 0, maxPct: 100, moisturePct: 4, nutrients: [{ name: 'Protein', amountPer100g: 80 }] },
    ]
    // Now 73.7% dry basis; ask for at most 60%, so milk must go up
    const result = solve({ lines, targets: [{ ...dryTarget, comparator: '<=', value: 60 }], yieldPct: 100, servingSizeG: null })
    expect(result.status).toBe('optimal')
    const m = result.suggestedPcts.milk, w = result.suggestedPcts.whey
    const dry = (m * 3.4 + w * 80) / (m * 0.13 + w * 0.96)
    expect(dry).toBeLessThanOrEqual(60.001)
    expect(dry).toBeGreaterThan(59.9)
    expect(result.auditTrace[0].achieved).toBeCloseTo(dry, 4)
    expect(result.auditTrace[0].requirement).toBe('≤ 60 g / 100 g dry')
  })
})

describe('parseUsdaWater', () => {
  it('reads Water from full and abridged USDA records', () => {
    expect(parseUsdaWater([{ nutrient: { id: 1003 }, amount: 3.3 }, { nutrient: { id: 1051 }, amount: 87.7 }])).toBe(87.7)
    expect(parseUsdaWater([{ number: '255', value: 4.2 }])).toBe(4.2)
    expect(parseUsdaWater([{ nutrient: { id: 1003 }, amount: 3.3 }])).toBeNull()
  })
})
