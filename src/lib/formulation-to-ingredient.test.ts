import { describe, expect, it } from 'vitest'
import { deriveIngredientFromFormulation, type SourceLine } from './formulation-to-ingredient'

const nutrients = [
  { id: 'protein', name: 'Protein', unit: 'g', category: 'macros' },
  { id: 'water', name: 'Water', unit: 'g', category: 'other' },
]

function line(over: Partial<SourceLine> = {}): SourceLine {
  return {
    weightG: 100,
    ingredientName: 'Pea protein',
    labelName: null,
    verification: 'verified',
    naturallyDerived: true,
    costPerKg: 10,
    nutrients: [],
    allergens: [],
    subIngredients: [],
    ...over,
  }
}

describe('deriveIngredientFromFormulation', () => {
  it('returns null when there is nothing to derive from', () => {
    expect(deriveIngredientFromFormulation({ lines: [], steps: [], allNutrients: nutrients })).toBeNull()
    expect(deriveIngredientFromFormulation({ lines: [line({ weightG: 0 })], steps: [], allNutrients: nutrients })).toBeNull()
  })

  it('blends nutrients per 100 g of the batch', () => {
    const d = deriveIngredientFromFormulation({
      lines: [
        line({ weightG: 25, nutrients: [{ nutrientId: 'protein', amountPer100g: 80 }] }),
        line({ weightG: 75, nutrients: [{ nutrientId: 'protein', amountPer100g: 0 }] }),
      ],
      steps: [],
      allNutrients: nutrients,
    })!
    expect(d.nutrients).toEqual([{ nutrientId: 'protein', amountPer100g: 20 }])
  })

  it('concentrates nutrients when a step drives off moisture', () => {
    const d = deriveIngredientFromFormulation({
      lines: [line({ weightG: 100, nutrients: [{ nutrientId: 'protein', amountPer100g: 10 }] })],
      steps: [{ lossType: 'moisture', lossAmount: 50, lossUnit: 'pct' }],
      allNutrients: nutrients,
    })!
    expect(d.nutrients[0].amountPer100g).toBeCloseTo(20)
    expect(d.finishedWeightG).toBeCloseTo(50)
  })

  it('reads moisture from the Water nutrient', () => {
    const d = deriveIngredientFromFormulation({
      lines: [line({ nutrients: [{ nutrientId: 'water', amountPer100g: 12.5 }] })],
      steps: [],
      allNutrients: nutrients,
    })!
    expect(d.moisturePct).toBeCloseTo(12.5)
  })

  it('unions allergens and lists the deck heaviest first, keeping compound lists', () => {
    const d = deriveIngredientFromFormulation({
      lines: [
        line({ weightG: 10, ingredientName: 'Salt', allergens: [] }),
        line({ weightG: 60, ingredientName: 'Soy Sauce', labelName: 'Soy sauce', allergens: ['soy', 'wheat'], subIngredients: ['Water', 'Soybeans'] }),
        line({ weightG: 30, ingredientName: 'Oat flour', allergens: ['gluten', 'wheat'] }),
      ],
      steps: [],
      allNutrients: nutrients,
    })!
    expect(d.allergens).toEqual(['gluten', 'soy', 'wheat'])
    expect(d.subIngredientNames).toEqual(['Soy sauce (Water, Soybeans)', 'Oat flour', 'Salt'])
  })

  it('costs the finished kg, and reports unknown when any line has no cost', () => {
    const lines = [line({ weightG: 500, costPerKg: 10 }), line({ weightG: 500, costPerKg: 20 })]
    const d = deriveIngredientFromFormulation({ lines, steps: [], allNutrients: nutrients })!
    expect(d.costPerKg).toBeCloseTo(15)

    const lossy = deriveIngredientFromFormulation({
      lines, steps: [{ lossType: 'production', lossAmount: 50, lossUnit: 'pct' }], allNutrients: nutrients,
    })!
    expect(lossy.costPerKg).toBeCloseTo(30) // same spend, half the product

    const unknown = deriveIngredientFromFormulation({
      lines: [...lines, line({ costPerKg: null })], steps: [], allNutrients: nutrients,
    })!
    expect(unknown.costPerKg).toBeNull()
  })

  it('is only verified / natural when every line is', () => {
    const d = deriveIngredientFromFormulation({
      lines: [line(), line({ verification: 'unverified', naturallyDerived: false })],
      steps: [],
      allNutrients: nutrients,
    })!
    expect(d.verification).toBe('unverified')
    expect(d.naturallyDerived).toBe(false)
  })
})
