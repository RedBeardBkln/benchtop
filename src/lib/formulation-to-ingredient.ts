// Pure derivation of an ingredient record from a finalized formulation — no side effects, fully testable

import { calcNutrientProfile, type CalcNutrient } from '@/lib/formulation-calc'
import type { LossStep } from '@/lib/process-loss'

export type SourceLine = {
  weightG: number
  ingredientName: string
  labelName: string | null
  verification: 'verified' | 'unverified'
  isIsolateOrConcentrate: boolean
  naturallyDerived: boolean
  costPerKg: number | null
  nutrients: Array<{ nutrientId: string; amountPer100g: number }>
  allergens: string[]
  /** The ingredient's own declared sub-ingredient list, in order (empty for simple ingredients). */
  subIngredients: string[]
}

export type DerivedIngredient = {
  /** Amount per 100 g of finished product (after process losses), full precision. */
  nutrients: Array<{ nutrientId: string; amountPer100g: number }>
  allergens: string[]
  /** Ingredient deck, heaviest first; compound ingredients keep their own list in parentheses. */
  subIngredientNames: string[]
  /** Cost of a kg of finished product; null unless every line has a cost. */
  costPerKg: number | null
  moisturePct: number | null
  verification: 'verified' | 'unverified'
  isIsolateOrConcentrate: boolean
  naturallyDerived: boolean
  finishedWeightG: number
}

export function deckEntry(line: Pick<SourceLine, 'ingredientName' | 'labelName' | 'subIngredients'>): string {
  const label = line.labelName?.trim() || line.ingredientName
  return line.subIngredients.length > 0 ? `${label} (${line.subIngredients.join(', ')})` : label
}

/**
 * Collapse a formulation into one ingredient, expressed per 100 g of finished product.
 * Nutrients use the same math as the formulation grid (process-step losses included), so the
 * saved ingredient matches what the formulation shows. Returns null when there is nothing to
 * derive from (no lines with weight).
 */
export function deriveIngredientFromFormulation(opts: {
  lines: SourceLine[]
  steps: LossStep[]
  allNutrients: CalcNutrient[]
}): DerivedIngredient | null {
  const lines = opts.lines.filter(l => l.weightG > 0)
  if (lines.length === 0) return null

  const calc = calcNutrientProfile({
    lines: lines.map((l, i) => ({ ingredientId: String(i), weightG: l.weightG, nutrients: l.nutrients })),
    allNutrients: opts.allNutrients,
    steps: opts.steps,
  })
  if (!(calc.finishedWeightG > 0)) return null

  const nutrients = calc.results.map(r => ({ nutrientId: r.nutrientId, amountPer100g: r.perFinished100g }))

  const water = calc.results.find(r => r.name.toLowerCase() === 'water' && r.unit === 'g')
  const moisturePct = water ? Math.min(100, Math.max(0, water.perFinished100g)) : null

  const allergens = [...new Set(lines.flatMap(l => l.allergens))].sort()

  const byWeight = [...lines].sort((a, b) => b.weightG - a.weightG)

  // A line with no cost makes the total meaningless, so report unknown rather than a partial figure
  const allCosted = lines.every(l => l.costPerKg != null)
  const totalCost = lines.reduce((s, l) => s + (l.weightG / 1000) * (l.costPerKg ?? 0), 0)
  const costPerKg = allCosted ? totalCost / (calc.finishedWeightG / 1000) : null

  return {
    nutrients,
    allergens,
    subIngredientNames: byWeight.map(deckEntry),
    costPerKg,
    moisturePct,
    verification: lines.every(l => l.verification === 'verified') ? 'verified' : 'unverified',
    isIsolateOrConcentrate: lines.some(l => l.isIsolateOrConcentrate),
    naturallyDerived: lines.every(l => l.naturallyDerived),
    finishedWeightG: calc.finishedWeightG,
  }
}
