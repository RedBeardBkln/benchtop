// Nutrient unit conversion — pure, no side effects.
//
// Every stored nutrient amount is in its nutrient's own unit (nutrients.unit), so values arriving
// in another unit (a parsed label, a target typed in mg for a mcg nutrient) must be converted first:
//   1 g = 1,000 mg = 1,000,000 mcg      1 kcal = 4.184 kJ

// Each mass unit as a power of ten of a gram (exact factors avoid float noise like 100.00000000000001)
const MASS_EXP: Record<string, number> = { g: 0, mg: -3, mcg: -6 }

// Vitamin forms that convert only for their own vitamin (FDA, "Converting Units of Measure for Folate,
// Niacin, and Vitamins A, D, and E"; IOM retinol and tocopherol equivalents). `factor` is how much of
// the vitamin's standard unit one of the form is worth. Mass forms scale: 1 mg β-carotene = 1,000 mcg.
// `alias`: accepted when read, but not offered in unit lists
type VitaminForm = { unit: string; factor: number; label: string; alias?: true }
type Vitamin = { standard: string; forms: VitaminForm[] }

const VITAMIN_A: Vitamin = {
  standard: 'mcg RAE',
  forms: [
    // A bare IU of vitamin A is read as retinol (retinyl acetate or palmitate), the usual spec-sheet form
    { unit: 'IU', factor: 0.3, label: 'IU (retinol)' },
    { unit: 'IU retinol', factor: 0.3, label: 'IU (retinol)', alias: true },
    // 1 IU β-carotene = 0.6 mcg β-carotene, worth 1/2 mcg RAE from a supplement and 1/12 from food
    { unit: 'IU beta-carotene', factor: 0.3, label: 'IU (β-carotene, supplement)' },
    { unit: 'IU dietary-beta-carotene', factor: 0.05, label: 'IU (β-carotene, food)' },
    { unit: 'mcg retinol', factor: 1, label: 'mcg retinol' },
    { unit: 'mcg beta-carotene', factor: 1 / 2, label: 'mcg β-carotene (supplement)' },
    { unit: 'mcg dietary-beta-carotene', factor: 1 / 12, label: 'mcg β-carotene (food)' },
  ],
}
const VITAMIN_D: Vitamin = { standard: 'mcg', forms: [{ unit: 'IU', factor: 0.025, label: 'IU' }] }
const VITAMIN_E: Vitamin = {
  // mg alpha-tocopherol. A bare IU isn't converted: natural and synthetic differ by half again
  standard: 'mg',
  forms: [
    { unit: 'IU natural', factor: 0.67, label: 'IU (natural, d-alpha)' },
    { unit: 'IU synthetic', factor: 0.45, label: 'IU (synthetic, dl-alpha)' },
    { unit: 'mg synthetic', factor: 0.5, label: 'mg dl-alpha-tocopherol' },
  ],
}
const FOLATE: Vitamin = {
  standard: 'mcg DFE',
  forms: [{ unit: 'mcg folic-acid', factor: 1.7, label: 'mcg folic acid' }],
}

// Other spellings of a form's qualifier → the one the vitamins above use
const QUALIFIER_ALIASES: Record<string, string> = {
  'β-carotene': 'beta-carotene', 'beta carotene': 'beta-carotene', 'betacarotene': 'beta-carotene',
  'supplemental beta-carotene': 'beta-carotene', 'supplemental β-carotene': 'beta-carotene',
  'dietary beta-carotene': 'dietary-beta-carotene', 'dietary β-carotene': 'dietary-beta-carotene',
  'food beta-carotene': 'dietary-beta-carotene',
  'retinyl acetate': 'retinol', 'retinyl palmitate': 'retinol', 'preformed': 'retinol',
  'd-alpha': 'natural', 'd-alpha-tocopherol': 'natural', 'rrr': 'natural', 'rrr-alpha-tocopherol': 'natural',
  'dl-alpha': 'synthetic', 'dl-alpha-tocopherol': 'synthetic', 'all-rac': 'synthetic',
  'all-rac-alpha-tocopherol': 'synthetic',
  'folic acid': 'folic-acid',
}

/** The vitamin a nutrient name refers to (Vitamin A, Vitamin D3, Folate…), if it has forms of its own */
function vitaminOf(nutrient: string | null | undefined): Vitamin | null {
  const n = (nutrient ?? '').trim().toLowerCase()
  if (/^vitamin a\b/.test(n) || n === 'retinol') return VITAMIN_A
  if (/^vitamin d[23]?\b/.test(n)) return VITAMIN_D
  if (/^vitamin e\b/.test(n) || n === 'alpha-tocopherol') return VITAMIN_E
  if (n === 'folate' || n === 'folic acid' || n.startsWith('vitamin b9')) return FOLATE
  return null
}

/** The form of `vitamin` a unit names, and how many of the form's own unit one of `unit` is */
function formOf(vitamin: Vitamin, unit: string): { form: VitaminForm; scale: number } | null {
  const u = parseUnit(unit)
  for (const form of vitamin.forms) {
    const f = parseUnit(form.unit)
    if (u.qualifier !== f.qualifier) continue
    const scale = u.base === f.base ? 1 : convertMass(1, u.base, f.base)
    if (scale != null) return { form, scale }
  }
  return null
}

/**
 * Units a vitamin can be given in besides its own, e.g. IU for vitamin D or folic acid for folate.
 * Empty for any other nutrient.
 */
export function vitaminUnitOptions(nutrient: string | null | undefined): Array<{ value: string; label: string }> {
  return vitaminOf(nutrient)?.forms.filter(f => !f.alias).map(f => ({ value: f.unit, label: f.label })) ?? []
}

/** How a unit reads in a list: a vitamin form's label ("IU (retinol)"), otherwise the unit itself */
export function unitLabel(unit: string, nutrient?: string | null): string {
  const vitamin = vitaminOf(nutrient)
  return (vitamin && vitamin.forms.find(f => f.unit === unit)?.label) || unit
}

type ParsedUnit = { base: string; qualifier: string }

/**
 * Split a unit into its base and an optional equivalence qualifier, normalizing spelling:
 * "µg" / "ug" / "MCG" → mcg, "mcg RAE" → mcg + rae, "KCAL" → kcal, "KJ" → kj,
 * "IU (d-alpha)" → iu + natural.
 */
export function parseUnit(unit: string): ParsedUnit {
  const [rawBase = '', ...rest] = unit.trim().split(/\s+/)
  let base = rawBase.toLowerCase()
  if (base === 'µg' || base === 'μg' || base === 'ug') base = 'mcg'
  if (base === 'gram' || base === 'grams') base = 'g'
  if (base === 'i.u.') base = 'iu'
  const qualifier = rest.join(' ').toLowerCase().replace(/^\((.*)\)$/, '$1')
  return { base, qualifier: QUALIFIER_ALIASES[qualifier] ?? qualifier }
}

function convertMass(value: number, from: string, to: string): number | null {
  if (!(from in MASS_EXP && to in MASS_EXP)) return null
  const exp = MASS_EXP[from] - MASS_EXP[to]
  return exp >= 0 ? value * 10 ** exp : value / 10 ** -exp
}

/**
 * Convert `value` from `fromUnit` to `toUnit`. Returns null when the units aren't compatible
 * (e.g. g → kcal, or mcg RAE → mcg DFE). A bare unit is compatible with a qualified one of the same
 * kind ("mcg" ↔ "mcg RAE"), since labels usually print just "mcg".
 *
 * Pass the nutrient's name to also convert that vitamin's own forms: IU of vitamins A, D and E,
 * β-carotene to mcg RAE, synthetic vitamin E to mg alpha-tocopherol, folic acid to mcg DFE.
 * Without it they can't be converted.
 */
export function convertToUnit(
  value: number,
  fromUnit: string,
  toUnit: string,
  nutrient?: string | null,
): number | null {
  if (fromUnit === toUnit) return value
  const vitamin = vitaminOf(nutrient)
  const from = vitamin && formOf(vitamin, fromUnit)
  const to = vitamin && formOf(vitamin, toUnit)
  if (vitamin && (from || to)) {
    // Through the vitamin's standard unit: form → standard → form
    const std = from ? value * from.scale * from.form.factor : convertPlain(value, fromUnit, vitamin.standard)
    if (std == null) return null
    return to ? std / to.form.factor / to.scale : convertPlain(std, vitamin.standard, toUnit)
  }
  return convertPlain(value, fromUnit, toUnit)
}

function convertPlain(value: number, fromUnit: string, toUnit: string): number | null {
  if (fromUnit === toUnit) return value
  const from = parseUnit(fromUnit)
  const to = parseUnit(toUnit)
  if (from.qualifier && to.qualifier && from.qualifier !== to.qualifier) return null

  if (from.base === to.base) return value
  const mass = convertMass(value, from.base, to.base)
  if (mass != null) return mass
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

/** "20 g", "20%", "20% DV", "400 IU (retinol)": a value with its unit, as targets show it */
export function withUnit(value: number | string, unit: string, nutrient?: string | null): string {
  return isPctUnit(unit) ? `${value}${unit}` : `${value} ${unitLabel(unit, nutrient)}`
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
  // The nutrient's name, so a vitamin's own units (IU, folic acid…) convert too
  nutrient?: string | null,
): number | null {
  if (targetUnit === PCT_OF_100G) return convertToUnit(amount, nutrientUnit, 'g')
  if (targetUnit === PCT_DV) return dailyValue && dailyValue > 0 ? (amount / dailyValue) * 100 : null
  return convertToUnit(amount, nutrientUnit, targetUnit, nutrient)
}

/** The reverse of amountInTargetUnit: a target value, in the nutrient's own unit */
export function targetValueInNutrientUnit(
  value: number,
  targetUnit: string,
  nutrientUnit: string,
  dailyValue: number | null | undefined,
  nutrient?: string | null,
): number | null {
  if (targetUnit === PCT_OF_100G) return convertToUnit(value, 'g', nutrientUnit)
  if (targetUnit === PCT_DV) return dailyValue && dailyValue > 0 ? (value / 100) * dailyValue : null
  return convertToUnit(value, targetUnit, nutrientUnit, nutrient)
}
