// Pure calculation functions — no side effects, fully testable

export type CalcLine = {
  ingredientId: string
  weightG: number
  nutrients: Array<{ nutrientId: string; amountPer100g: number }>
}

export type CalcNutrient = {
  id: string
  name: string
  unit: string
  category: string
}

export type NutrientResult = {
  nutrientId: string
  name: string
  unit: string
  category: string
  perFinished100g: number
  perServing?: number
}

export type CalcResult = {
  results: NutrientResult[]
  totalWeightG: number
  finishedWeightG: number
}

/**
 * Calculate nutrient profile of a formulation.
 *
 * Math:
 *   contribution_n from line_i  = amountPer100g_n × weightG_i / 100
 *   total_n in batch            = Σ contributions
 *   per 100g finished           = total_n / finishedWeightG × 100
 *   finishedWeightG             = totalWeightG × yieldPct / 100
 */
export function calcNutrientProfile(opts: {
  lines: CalcLine[]
  allNutrients: CalcNutrient[]
  servingSizeG?: number
  yieldPct?: number
}): CalcResult {
  const { lines, allNutrients, servingSizeG, yieldPct = 100 } = opts

  const totalWeightG = lines.reduce((s, l) => s + l.weightG, 0)
  const finishedWeightG = totalWeightG * (yieldPct / 100)

  // Accumulate absolute amounts contributed by each line
  const totals = new Map<string, number>()
  for (const line of lines) {
    if (line.weightG <= 0) continue
    for (const n of line.nutrients) {
      if (n.amountPer100g == null) continue
      const contrib = n.amountPer100g * (line.weightG / 100)
      totals.set(n.nutrientId, (totals.get(n.nutrientId) ?? 0) + contrib)
    }
  }

  const results: NutrientResult[] = []
  for (const nutrient of allNutrients) {
    const inBatch = totals.get(nutrient.id)
    if (inBatch === undefined) continue

    const per100g = finishedWeightG > 0 ? (inBatch / finishedWeightG) * 100 : 0

    results.push({
      nutrientId: nutrient.id,
      name: nutrient.name,
      unit: nutrient.unit,
      category: nutrient.category,
      perFinished100g: per100g,
      perServing: servingSizeG != null ? (per100g * servingSizeG) / 100 : undefined,
    })
  }

  return { results, totalWeightG, finishedWeightG }
}

export function formatAmt(amount: number, unit: string): string {
  if (unit === 'kcal') return amount.toFixed(0)
  if (amount === 0) return '0'
  if (amount < 0.01) return amount.toFixed(4)
  if (amount < 0.1) return amount.toFixed(3)
  if (amount < 10) return amount.toFixed(2)
  return amount.toFixed(1)
}
