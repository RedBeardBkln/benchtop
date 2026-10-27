// Units an ingredient amount can be shown and typed in. Amounts are always stored in grams; these
// only change how a weight is displayed and entered. Volume units need the ingredient's density.

export const MASS_UNITS = ['g', 'kg', 'mg', 'oz', 'lb'] as const
export const VOLUME_UNITS = ['mL', 'L', 'tsp', 'tbsp', 'fl oz', 'cup'] as const
export const WEIGHT_UNITS = [...MASS_UNITS, ...VOLUME_UNITS] as const
export type WeightUnit = (typeof WEIGHT_UNITS)[number]

// Grams in one unit of each mass unit (avoirdupois oz and lb)
const GRAMS_PER: Record<(typeof MASS_UNITS)[number], number> = {
  g: 1, kg: 1000, mg: 0.001, oz: 28.349523125, lb: 453.59237,
}
// Milliliters in one unit of each volume unit (US customary)
const ML_PER: Record<(typeof VOLUME_UNITS)[number], number> = {
  mL: 1, L: 1000, tsp: 4.92892159375, tbsp: 14.78676478125, 'fl oz': 29.5735295625, cup: 236.5882365,
}

export const UNIT_LABELS: Record<WeightUnit, string> = {
  g: 'g', kg: 'kg', mg: 'mg', oz: 'oz', lb: 'lb',
  mL: 'mL', L: 'L', tsp: 'tsp', tbsp: 'tbsp', 'fl oz': 'fl oz', cup: 'cup',
}

export const isWeightUnit = (u: unknown): u is WeightUnit => (WEIGHT_UNITS as readonly unknown[]).includes(u)
export const isVolumeUnit = (u: WeightUnit) => (VOLUME_UNITS as readonly string[]).includes(u)

/**
 * The unit a line is actually shown in: its own choice, else the column's. A volume unit needs the
 * ingredient's density (g per mL); without one the line falls back to grams.
 */
export function effectiveUnit(lineUnit: WeightUnit | null | undefined, columnUnit: WeightUnit, densityGPerMl: number | null | undefined): WeightUnit {
  const unit = lineUnit ?? columnUnit
  return isVolumeUnit(unit) && !(densityGPerMl && densityGPerMl > 0) ? 'g' : unit
}

/** Grams → the unit. Null for a volume unit without a density. */
export function fromGrams(grams: number, unit: WeightUnit, densityGPerMl?: number | null): number | null {
  if (unit in GRAMS_PER) return grams / GRAMS_PER[unit as keyof typeof GRAMS_PER]
  if (!densityGPerMl || densityGPerMl <= 0) return null
  return grams / densityGPerMl / ML_PER[unit as keyof typeof ML_PER]
}

/** An amount in the unit → grams, rounded to the 4 decimals grams are stored with. Null for a volume unit without a density. */
export function toGrams(amount: number, unit: WeightUnit, densityGPerMl?: number | null): number | null {
  let g: number
  if (unit in GRAMS_PER) g = amount * GRAMS_PER[unit as keyof typeof GRAMS_PER]
  else if (!densityGPerMl || densityGPerMl <= 0) return null
  else g = amount * ML_PER[unit as keyof typeof ML_PER] * densityGPerMl
  return Math.round(g * 1e4) / 1e4
}

// Decimal places an amount is shown and typed with. Grams keep their 4; other units get as many as
// grams stored to 4 places can hold, so 1 oz (28.3495 g) reads back as 1, not 0.999999
export const UNIT_DECIMALS: Record<WeightUnit, number> = {
  g: 4, mg: 1, kg: 7, oz: 5, lb: 6, mL: 3, L: 6, tsp: 4, tbsp: 4, 'fl oz': 5, cup: 5,
}

/** An amount in a unit for display: up to that unit's decimals, trailing zeros dropped */
export function formatInUnit(amount: number, unit: WeightUnit): string {
  return String(Number(amount.toFixed(UNIT_DECIMALS[unit])))
}

/** True for text that is a (possibly partially typed) amount in the unit */
export function isAmountInput(raw: string, unit: WeightUnit): boolean {
  return new RegExp(`^\\d*\\.?\\d{0,${UNIT_DECIMALS[unit]}}$`).test(raw)
}

/**
 * Grams shown in a unit with its label, e.g. "1.5 lb". Falls back to grams when a volume unit has no
 * density, e.g. a batch total (a mix of ingredients has no single density).
 */
export function formatGramsIn(grams: number, unit: WeightUnit, densityGPerMl?: number | null): string {
  const amount = fromGrams(grams, unit, densityGPerMl)
  return amount == null
    ? `${Number(grams.toFixed(UNIT_DECIMALS.g))} g`
    : `${formatInUnit(amount, unit)} ${UNIT_LABELS[unit]}`
}
