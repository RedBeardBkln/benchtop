type LossInput = {
  lossType?: 'production' | 'moisture' | null
  lossAmount?: number | null
  lossUnit?: 'g' | 'pct'
}

/** Validation message for a step's loss fields, or null when they are consistent. */
export function lossFieldsError(d: LossInput): string | null {
  if (!d.lossType) return null
  if (d.lossAmount == null || d.lossAmount <= 0) return 'Enter a loss amount greater than 0'
  if (d.lossUnit === 'pct' && d.lossAmount > 100) return 'A percentage loss cannot exceed 100%'
  return null
}

/** Column values for a step's loss; no type means no loss, so the amount is cleared too. */
export function lossFields(d: LossInput) {
  if (!d.lossType) return { lossType: null, lossAmount: null, lossUnit: 'g' }
  return { lossType: d.lossType, lossAmount: d.lossAmount!.toString(), lossUnit: d.lossUnit ?? 'g' }
}
