// Pure calculation functions — no side effects, fully testable

import type { LossStep, ProcessFlow } from '@/lib/process-loss'
import { flowForLines, stageIndex } from '@/lib/staged-additions'

export type CalcLine = {
  ingredientId: string
  weightG: number
  nutrients: Array<{ nutrientId: string; amountPer100g: number }>
  /** The ingredient's water, % of its weight; needed for dry-basis values */
  moisturePct?: number | null
  /** Process step this line is added after (see lib/staged-additions.ts); null = the starting blend */
  addedAfterStepId?: string | null
}

export type CalcNutrient = {
  id: string
  name: string
  unit: string
  category: string
  /**
   * FDA Daily Value for this nutrient (mg, mcg, g, kcal, etc. — same unit as `unit`).
   * Pulled straight from `nutrients.dailyValueAmount` in the DB so that DV
   * updates happen via a seed migration rather than a code release. Null when
   * the nutrient has no established DV (e.g. trans fat, sugar alcohols).
   */
  dailyValueAmount?: number | null
}

export type NutrientResult = {
  nutrientId: string
  name: string
  unit: string
  category: string
  perFinished100g: number
  perServing?: number
  /** Carried through from CalcNutrient so renderers can compute %DV from the DB. */
  dailyValueAmount: number | null
}

/**
 * Calculate nutrient profile of a formulation.
 *
 * Math:
 *   contribution_n from line_i  = amountPer100g_n × weightG_i / 100
 *   total_n in batch            = Σ contributions
 *   per 100g finished           = total_n / (totalWeightG × concentrationYield) × 100
 *
 * Yield comes from the per-step losses (see simulateProcess): production loss
 * lowers the finished weight without changing the profile, moisture loss
 * concentrates it. A line added after a step only goes through the steps after it,
 * so its contribution is scaled by its stage factor (see `stageFactors`).
 */
export function calcNutrientProfile(opts: {
  lines: CalcLine[]
  allNutrients: CalcNutrient[]
  servingSizeG?: number
  steps?: LossStep[]
}): CalcResult {
  const { lines, allNutrients, servingSizeG, steps = [] } = opts

  const totalWeightG = lines.reduce((s, l) => s + l.weightG, 0)

  const processYield = flowForLines(lines, steps)
  const { finishedWeightG } = processYield

  // Production loss takes a share of whatever is in the batch at that step. Relative to the starting blend,
  // an ingredient added later keeps more of itself: that ratio is its stage factor (1 with no staging).
  const keptRef = processYield.keptFromStart > 0 ? processYield.keptFromStart : 1
  const stageFactors: Record<string, number> = {}
  steps.forEach((s, i) => { if (s.id) stageFactors[s.id] = processYield.keptAfterStep[i] / keptRef })
  const factorOf = (l: CalcLine) => (stageIndex(l.addedAfterStepId, steps) >= 0 ? stageFactors[l.addedAfterStepId!] : 1)

  // Weight the batch's nutrients (as weighed in the starting blend) are spread over once moisture has left
  const concentrationWeightG = processYield.keptFromStart > 0 ? finishedWeightG / keptRef : totalWeightG

  // Accumulate absolute amounts contributed by each line
  const totals = new Map<string, number>()
  for (const line of lines) {
    if (line.weightG <= 0) continue
    const factor = factorOf(line)
    for (const n of line.nutrients) {
      if (n.amountPer100g == null) continue
      const contrib = n.amountPer100g * (line.weightG / 100) * factor
      totals.set(n.nutrientId, (totals.get(n.nutrientId) ?? 0) + contrib)
    }
  }

  const results: NutrientResult[] = []
  for (const nutrient of allNutrients) {
    const inBatch = totals.get(nutrient.id)
    if (inBatch === undefined) continue

    const per100g = concentrationWeightG > 0 ? (inBatch / concentrationWeightG) * 100 : 0

    results.push({
      nutrientId: nutrient.id,
      name: nutrient.name,
      unit: nutrient.unit,
      category: nutrient.category,
      perFinished100g: per100g,
      perServing: servingSizeG != null ? (per100g * servingSizeG) / 100 : undefined,
      dailyValueAmount: nutrient.dailyValueAmount ?? null,
    })
  }

  // Dry matter: what's left of the batch without its water. Process losses don't change the dry-basis
  // profile (production loss takes solids and nutrients alike; moisture loss takes only water), so it's
  // measured on the ingredients as weighed. Unknown when any ingredient used has no moisture %.
  const missingMoistureIds = lines.filter(l => l.weightG > 0 && l.moisturePct == null).map(l => l.ingredientId)
  const dryMatterG = missingMoistureIds.length > 0
    ? null
    : lines.reduce((s, l) => s + (l.weightG > 0 ? l.weightG * factorOf(l) * (1 - Math.min(100, Math.max(0, l.moisturePct ?? 0)) / 100) : 0), 0)

  return { results, totalWeightG, finishedWeightG, concentrationWeightG, processYield, stageFactors, dryMatterG, missingMoistureIds }
}

/**
 * Multiplier from a per-100 g finished value to per 100 g of dry matter, or null when the dry matter
 * isn't known (an ingredient without a moisture %) or is zero.
 */
export function dryBasisFactor(calc: Pick<CalcResult, 'concentrationWeightG' | 'dryMatterG'>): number | null {
  return calc.dryMatterG != null && calc.dryMatterG > 0 ? calc.concentrationWeightG / calc.dryMatterG : null
}

export type CalcResult = {
  results: NutrientResult[]
  totalWeightG: number
  finishedWeightG: number
  /** Weight the batch's nutrients are spread over once moisture has left (the per-100 g basis) */
  concentrationWeightG: number
  processYield: ProcessFlow
  /**
   * By step id: how much of a line added after that step reaches the finished product, relative to the
   * starting blend (1 with no production loss after it). Pass to calcNutrientContributions.
   */
  stageFactors: Record<string, number>
  /** Grams of dry matter in the batch, or null when an ingredient's moisture % is unknown */
  dryMatterG: number | null
  /** Ingredients in the batch without a moisture % */
  missingMoistureIds: string[]
}

export type NutrientContribution<L> = {
  line: L
  /** Amount this line puts into the batch (scaled by its stage factor when added after a step) */
  inBatch: number
  /** This line's part of the nutrient's per-100 g finished value (the parts sum to the total) */
  perFinished100g: number
  /** Share of the nutrient's total, 0–100 */
  sharePct: number
}

/**
 * How much of one nutrient each line contributes, largest first.
 * Lines that contribute none are left out.
 */
export function calcNutrientContributions<L extends CalcLine>(
  lines: L[],
  nutrientId: string,
  concentrationWeightG: number,
  stageFactors: Record<string, number> = {},
): NutrientContribution<L>[] {
  const amounts = lines.flatMap(line => {
    if (line.weightG <= 0) return []
    const n = line.nutrients.find(n => n.nutrientId === nutrientId)
    if (!n || n.amountPer100g == null) return []
    const factor = line.addedAfterStepId ? stageFactors[line.addedAfterStepId] ?? 1 : 1
    const inBatch = n.amountPer100g * (line.weightG / 100) * factor
    return inBatch > 0 ? [{ line, inBatch }] : []
  })
  const total = amounts.reduce((s, a) => s + a.inBatch, 0)
  return amounts
    .map(({ line, inBatch }) => ({
      line,
      inBatch,
      perFinished100g: concentrationWeightG > 0 ? (inBatch / concentrationWeightG) * 100 : 0,
      sharePct: total > 0 ? (inBatch / total) * 100 : 0,
    }))
    .sort((a, b) => b.inBatch - a.inBatch)
}

export type ContributionReportRow<L> = NutrientContribution<L> & {
  /** This line's part of the nutrient's per-serving value, when a serving size is set */
  perServing?: number
}

export type ContributionReportNutrient<L> = {
  nutrient: NutrientResult
  contributions: ContributionReportRow<L>[]
  /** Lines that put none of this nutrient in (no value, zero, or no weight) */
  noneCount: number
}

/**
 * Every nutrient in the profile, each broken out by contributing line, in the profile's order.
 * The per-100 g and per-serving parts add up to the nutrient's totals in `result`.
 */
export function buildContributionReport<L extends CalcLine>(
  lines: L[],
  result: CalcResult,
  servingSizeG?: number,
): ContributionReportNutrient<L>[] {
  const perServing = servingSizeG != null && servingSizeG > 0
  return result.results.map(nutrient => {
    const contributions = calcNutrientContributions(lines, nutrient.nutrientId, result.concentrationWeightG, result.stageFactors)
      .map(c => ({ ...c, perServing: perServing ? (c.perFinished100g * servingSizeG) / 100 : undefined }))
    return { nutrient, contributions, noneCount: lines.length - contributions.length }
  })
}

export function formatAmt(amount: number, unit: string): string {
  if (unit === 'kcal') return Math.round(amount).toString()
  if (amount === 0) return '0'
  if (amount < 0.01) return amount.toFixed(4)
  if (amount < 0.1) return amount.toFixed(3)
  if (amount < 10) return amount.toFixed(2)
  if (amount < 100) return amount.toFixed(1)
  return Math.round(amount).toString()
}
