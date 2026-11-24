type LossType = 'production' | 'moisture'
type LossUnit = 'g' | 'pct'

type LossInput = {
  lossType?: LossType | null
  lossAmount?: number | null
  lossUnit?: LossUnit
  /** A second loss, applied after the first */
  loss2Type?: LossType | null
  loss2Amount?: number | null
  loss2Unit?: LossUnit
}

function oneLossError(type: LossType | null | undefined, amount: number | null | undefined, unit: LossUnit | undefined, which: string): string | null {
  if (!type) return null
  if (amount == null || amount <= 0) return `Enter ${which} amount greater than 0`
  if (unit === 'pct' && amount > 100) return 'A percentage loss cannot exceed 100%'
  return null
}

/** Validation message for a step's loss fields, or null when they are consistent. */
export function lossFieldsError(d: LossInput): string | null {
  return oneLossError(d.lossType, d.lossAmount, d.lossUnit, 'a loss')
    ?? oneLossError(d.loss2Type, d.loss2Amount, d.loss2Unit, 'the second loss')
}

/**
 * Column values for a step's losses, sent as a unit: no type means no loss, so its amount is cleared too.
 * A second loss with no first one moves up to be the first.
 */
export function lossFields(d: LossInput) {
  const losses = [
    { type: d.lossType, amount: d.lossAmount, unit: d.lossUnit },
    { type: d.loss2Type, amount: d.loss2Amount, unit: d.loss2Unit },
  ].filter(l => l.type)
  const [first, second] = losses
  return {
    lossType: first?.type ?? null,
    lossAmount: first ? first.amount!.toString() : null,
    lossUnit: first?.unit ?? 'g',
    loss2Type: second?.type ?? null,
    loss2Amount: second ? second.amount!.toString() : null,
    loss2Unit: second?.unit ?? 'g',
  }
}
