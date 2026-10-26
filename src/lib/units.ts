// Nutrient unit conversion — pure, no side effects.
//
// Every stored nutrient amount is in its nutrient's own unit (nutrients.unit), so values arriving
// in another unit (a parsed label, a target typed in mg for a mcg nutrient) must be converted first:
//   1 g = 1,000 mg = 1,000,000 mcg      1 kcal = 4.184 kJ

// Each mass unit as a power of ten of a gram (exact factors avoid float noise like 100.00000000000001)
const MASS_EXP: Record<string, number> = { g: 0, mg: -3, mcg: -6 }

type ParsedUnit = { base: string; qualifier: string }

/**
 * Split a unit into its base and an optional equivalence qualifier, normalizing spelling:
 * "µg" / "ug" / "MCG" → mcg, "mcg RAE" → mcg + rae, "KCAL" → kcal, "KJ" → kj.
 */
export function parseUnit(unit: string): ParsedUnit {
  const [rawBase = '', ...rest] = unit.trim().split(/\s+/)
  let base = rawBase.toLowerCase()
  if (base === 'µg' || base === 'μg' || base === 'ug') base = 'mcg'
  if (base === 'gram' || base === 'grams') base = 'g'
  return { base, qualifier: rest.join(' ').toLowerCase() }
}

/**
 * Convert `value` from `fromUnit` to `toUnit`. Returns null when the units aren't compatible
 * (e.g. g → IU, or mcg RAE → mcg DFE). A bare unit is compatible with a qualified one of the same
 * kind ("mcg" ↔ "mcg RAE"), since labels usually print just "mcg".
 */
export function convertToUnit(value: number, fromUnit: string, toUnit: string): number | null {
  if (fromUnit === toUnit) return value
  const from = parseUnit(fromUnit)
  const to = parseUnit(toUnit)
  if (from.qualifier && to.qualifier && from.qualifier !== to.qualifier) return null

  if (from.base === to.base) return value
  if (from.base in MASS_EXP && to.base in MASS_EXP) {
    const exp = MASS_EXP[from.base] - MASS_EXP[to.base]
    return exp >= 0 ? value * 10 ** exp : value / 10 ** -exp
  }
  if (from.base === 'kcal' && to.base === 'kj') return value * 4.184
  if (from.base === 'kj' && to.base === 'kcal') return value / 4.184
  return null
}

// Project targets can also be typed as a share instead of an amount:
//   "%"    — percent of the product's weight, i.e. grams per 100 g (20% protein = 20 g per 100 g)
//   "% DV" — percent of the nutrient's FDA Daily Value (20% DV calcium = 260 mg when the DV is 1,300 mg)
export const PCT_OF_100G = '%'
export const PCT_DV = '% DV'

export const isPctUnit = (unit: string) => unit === PCT_OF_100G || unit === PCT_DV

/** "20 g", "20%", "20% DV": a value with its unit, as targets show it */
export function withUnit(value: number | string, unit: string): string {
  return isPctUnit(unit) ? `${value}${unit}` : `${value} ${unit}`
}

/**
 * An amount of a nutrient, in its own unit, expressed in a target's unit. A % DV needs the
 * nutrient's Daily Value (in the nutrient's unit). Null when the two can't be compared, e.g.
 * a % of weight for an energy nutrient, or a % DV for a nutrient without a Daily Value.
 */
export function amountInTargetUnit(
  amount: number,
  nutrientUnit: string,
  targetUnit: string,
  dailyValue: number | null | undefined,
): number | null {
  if (targetUnit === PCT_OF_100G) return convertToUnit(amount, nutrientUnit, 'g')
  if (targetUnit === PCT_DV) return dailyValue && dailyValue > 0 ? (amount / dailyValue) * 100 : null
  return convertToUnit(amount, nutrientUnit, targetUnit)
}

/** The reverse of amountInTargetUnit: a target value, in the nutrient's own unit */
export function targetValueInNutrientUnit(
  value: number,
  targetUnit: string,
  nutrientUnit: string,
  dailyValue: number | null | undefined,
): number | null {
  if (targetUnit === PCT_OF_100G) return convertToUnit(value, 'g', nutrientUnit)
  if (targetUnit === PCT_DV) return dailyValue && dailyValue > 0 ? (value / 100) * dailyValue : null
  return convertToUnit(value, targetUnit, nutrientUnit)
}
