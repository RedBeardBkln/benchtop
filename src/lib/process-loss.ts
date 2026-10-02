// Pure process-loss math — no side effects, fully testable

export type LossType = 'production' | 'moisture'
export type LossUnit = 'g' | 'pct'

export type LossStep = {
  lossType: string | null
  lossAmount: number | null
  lossUnit: string | null
}

export type ProcessYield = {
  /** Batch weight after every step's loss has been applied. */
  finishedWeightG: number
  /** finishedWeightG / input weight × 100 — what the user sees as "Yield". */
  yieldPct: number
  /** Grams left behind on equipment (product removed — composition unchanged). */
  productionLossG: number
  /** Grams of water driven off (nutrients stay — profile concentrates). */
  moistureLossG: number
  /**
   * Divisor for per-100g-finished concentrations, as a percent of input weight.
   * Production loss removes product *and* its nutrients, so it cancels out;
   * only moisture loss concentrates the profile. Equals yieldPct when there is
   * no production loss.
   */
  concentrationYieldPct: number
}

/**
 * Apply each step's loss, in order, to the running batch weight.
 *
 * - production: product (nutrients included) is lost → weight and nutrient
 *   total shrink together, so per-100g values don't change.
 * - moisture: only water leaves → nutrients stay in a smaller weight, so
 *   per-100g values rise.
 * - unit 'pct' is taken of the weight entering that step; 'g' is absolute.
 * A loss can never exceed the weight remaining at that step.
 */
export function computeProcessYield(inputWeightG: number, steps: LossStep[]): ProcessYield {
  if (!(inputWeightG > 0)) {
    return { finishedWeightG: 0, yieldPct: 100, productionLossG: 0, moistureLossG: 0, concentrationYieldPct: 100 }
  }

  let weight = inputWeightG
  let nutrientFraction = 1 // share of the original nutrients still in the batch
  let productionLossG = 0
  let moistureLossG = 0

  for (const s of steps) {
    if ((s.lossType !== 'production' && s.lossType !== 'moisture') || !(s.lossAmount != null && s.lossAmount > 0)) continue
    const requested = s.lossUnit === 'pct' ? weight * (s.lossAmount / 100) : s.lossAmount
    const loss = Math.min(requested, weight)
    if (loss <= 0) continue

    if (s.lossType === 'production') {
      nutrientFraction *= (weight - loss) / weight
      productionLossG += loss
    } else {
      moistureLossG += loss
    }
    weight -= loss
  }

  return {
    finishedWeightG: weight,
    yieldPct: (weight / inputWeightG) * 100,
    productionLossG,
    moistureLossG,
    // nutrientFraction is 0 only if everything was lost; fall back to a neutral 100
    concentrationYieldPct: nutrientFraction > 0 ? (weight / nutrientFraction / inputWeightG) * 100 : 100,
  }
}

/** Parse the numeric DB column (returned as a string) for use in the calc. */
export function toLossStep(step: {
  lossType: string | null
  lossAmount: string | null
  lossUnit: string | null
}): LossStep {
  return {
    lossType: step.lossType,
    lossAmount: step.lossAmount != null ? parseFloat(step.lossAmount) : null,
    lossUnit: step.lossUnit,
  }
}

export const LOSS_TYPE_LABEL: Record<LossType, string> = {
  production: 'Production loss',
  moisture: 'Moisture loss',
}

/** e.g. "Moisture loss: 12.5%" — null when the step has no loss. */
export function describeStepLoss(step: {
  lossType: string | null
  lossAmount: string | null
  lossUnit: string | null
}): string | null {
  if ((step.lossType !== 'production' && step.lossType !== 'moisture') || step.lossAmount == null) return null
  const amount = parseFloat(step.lossAmount)
  if (!(amount > 0)) return null
  return `${LOSS_TYPE_LABEL[step.lossType]}: ${Number(amount.toFixed(2))}${step.lossUnit === 'pct' ? '%' : ' g'}`
}
