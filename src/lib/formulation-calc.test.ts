import { describe, expect, it } from 'vitest'
import { calcNutrientContributions, calcNutrientProfile } from './formulation-calc'

const PROTEIN = 'protein'
const lines = [
  { ingredientId: 'a', weightG: 50, nutrients: [{ nutrientId: PROTEIN, amountPer100g: 10 }] }, // 5 g
  { ingredientId: 'b', weightG: 30, nutrients: [{ nutrientId: PROTEIN, amountPer100g: 50 }] }, // 15 g
  { ingredientId: 'c', weightG: 20, nutrients: [] },                                           // none
]

describe('calcNutrientContributions', () => {
  it('splits a nutrient across lines, largest first, skipping lines with none', () => {
    const out = calcNutrientContributions(lines, PROTEIN, 100)
    expect(out.map(c => c.line.ingredientId)).toEqual(['b', 'a'])
    expect(out[0].inBatch).toBeCloseTo(15)
    expect(out[0].sharePct).toBeCloseTo(75)
    expect(out[1].sharePct).toBeCloseTo(25)
  })

  it('per-100 g parts add up to the profile total, including moisture concentration', () => {
    const steps = [{ lossType: 'moisture', lossAmount: 20, lossUnit: 'g' }]
    const profile = calcNutrientProfile({
      lines,
      allNutrients: [{ id: PROTEIN, name: 'Protein', unit: 'g', category: 'macros' }],
      steps,
    })
    const parts = calcNutrientContributions(lines, PROTEIN, profile.concentrationWeightG)
    const sum = parts.reduce((s, c) => s + c.perFinished100g, 0)
    expect(sum).toBeCloseTo(profile.results[0].perFinished100g)
    expect(sum).toBeCloseTo(25) // 20 g protein over 80 g after 20 g of water left
  })

  it('ignores lines with no weight', () => {
    const out = calcNutrientContributions([{ ...lines[0], weightG: 0 }], PROTEIN, 100)
    expect(out).toEqual([])
  })
})
