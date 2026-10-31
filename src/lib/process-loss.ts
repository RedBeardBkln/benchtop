// Pure process-loss math — no side effects, fully testable

export type LossType = 'production' | 'moisture'
export type LossUnit = 'g' | 'pct'

export type LossStep = {
  /** The step's id, for ingredients added after it (see simulateProcess) */
  id?: string
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

export type ProcessFlow = ProcessYield & {
  /** Everything that went in: the starting blend plus every addition after a step */
  inputWeightG: number
  /** Batch weight leaving each step (after its loss, before anything added after it), by step index */
  massAfterStepG: number[]
  /**
   * Share of the material in the batch just after step i (additions included) that is still there at the
   * end. Production loss at a later step takes product, so it takes part of this material too.
   */
  keptAfterStep: number[]
  /** The same share for the starting blend */
  keptFromStart: number
}

/**
 * Run the batch through each step in order.
 *
 * - production: product (nutrients included) is lost → weight and nutrient
 *   total shrink together, so per-100g values don't change.
 * - moisture: only water leaves → nutrients stay in a smaller weight, so
 *   per-100g values rise.
 * - unit 'pct' is taken of the weight entering that step; 'g' is absolute.
 * A loss can never exceed the weight remaining at that step.
 *
 * `addAfter(i, massG)` returns the grams added once step i's loss is applied, given the batch weight
 * leaving it; those grams are only subject to the steps after i.
 */
export function simulateProcess(
  startWeightG: number,
  steps: LossStep[],
  addAfter?: (stepIndex: number, massG: number) => number,
): ProcessFlow {
  let weight = Math.max(0, startWeightG)
  let inputWeightG = weight
  let productionLossG = 0
  let moistureLossG = 0
  const massAfterStepG: number[] = []
  // Share of what enters step i that leaves it as product (moisture loss takes only water: 1)
  const productKept: number[] = []

  steps.forEach((s, i) => {
    let kept = 1
    if ((s.lossType === 'production' || s.lossType === 'moisture') && s.lossAmount != null && s.lossAmount > 0 && weight > 0) {
      const requested = s.lossUnit === 'pct' ? weight * (s.lossAmount / 100) : s.lossAmount
      const loss = Math.min(requested, weight)
      if (s.lossType === 'production') {
        kept = (weight - loss) / weight
        productionLossG += loss
      } else {
        moistureLossG += loss
      }
      weight -= loss
    }
    productKept.push(kept)
    massAfterStepG.push(weight)
    const added = addAfter ? Math.max(0, addAfter(i, weight)) : 0
    weight += added
    inputWeightG += added
  })

  const keptAfterStep: number[] = new Array(steps.length)
  let kept = 1
  for (let i = steps.length - 1; i >= 0; i--) {
    keptAfterStep[i] = kept
    kept *= productKept[i]
  }
  const keptFromStart = kept

  if (!(inputWeightG > 0)) {
    return {
      finishedWeightG: 0, yieldPct: 100, productionLossG: 0, moistureLossG: 0, concentrationYieldPct: 100,
      inputWeightG: 0, massAfterStepG, keptAfterStep, keptFromStart,
    }
  }
  return {
    finishedWeightG: weight,
    yieldPct: (weight / inputWeightG) * 100,
    productionLossG,
    moistureLossG,
    // keptFromStart is 0 only if everything was lost; fall back to a neutral 100
    concentrationYieldPct: keptFromStart > 0 ? (weight / keptFromStart / inputWeightG) * 100 : 100,
    inputWeightG,
    massAfterStepG,
    keptAfterStep,
    keptFromStart,
  }
}

/** Apply each step's loss, in order, to the whole batch (nothing added along the way). */
export function computeProcessYield(inputWeightG: number, steps: LossStep[]): ProcessYield {
  const { finishedWeightG, yieldPct, productionLossG, moistureLossG, concentrationYieldPct } = simulateProcess(inputWeightG, steps)
  return { finishedWeightG, yieldPct, productionLossG, moistureLossG, concentrationYieldPct }
}

/** Parse the numeric DB column (returned as a string) for use in the calc. */
export function toLossStep(step: {
  id?: string
  lossType: string | null
  lossAmount: string | null
  lossUnit: string | null
}): LossStep {
  return {
    id: step.id,
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
