import type { ProjectTarget } from '@/lib/types'
import type { NutrientResult } from '@/lib/formulation-calc'

export type ValidationStatus = 'pass' | 'fail' | 'warn' | 'no-data'

export const CATEGORY_ORDER = ['macros', 'vitamins', 'minerals', 'other'] as const

/**
 * Resolve the actual per-100 g (or per-serving) value for a target, converted
 * into the target's own unit (`t.unit`). Returns null when it cannot be
 * determined: no matching nutrient, per-serving basis without a serving size,
 * or a unit pair that is not a known compatible conversion.
 *
 * Shared by validateTarget (pass/fail) and evaluateTargets (displayed value) so
 * the two can never disagree about the unit.
 */
function resolveActual(
  t: ProjectTarget,
  results: NutrientResult[],
  formulationServingG: number | undefined,
): number | null {
  const r = results.find(r => r.name === t.nutrient)
  if (!r) return null
  // Use formulation serving size first, then fall back to the target's own reference serving size
  const servingSizeG = formulationServingG ?? t.servingSizeG
  if (t.basis === 'per_serving' && !servingSizeG) return null

  // Convert the actual per-100g value into the target's unit before comparing.
  // Without this, a target specified in g would silently never match a value
  // stored in mg (or vice-versa). We only handle the common FDA mass/energy
  // conversions — anything else returns null ('no-data') to surface the mismatch.
  const converted = convertToUnit(r.perFinished100g, r.unit, t.unit)
  if (converted == null) return null

  return t.basis === 'per_serving'
    ? converted * (servingSizeG! / 100)
    : converted
}

export function validateTarget(
  t: ProjectTarget,
  results: NutrientResult[],
  formulationServingG: number | undefined,
): ValidationStatus {
  const actual = resolveActual(t, results, formulationServingG)
  if (actual == null) return 'no-data'

  const W = 0.05  // 5% warn margin
  switch (t.comparator) {
    case '>=': return actual >= t.value ? 'pass' : actual >= t.value * (1 - W) ? 'warn' : 'fail'
    case '<=': return actual <= t.value ? 'pass' : actual <= t.value * (1 + W) ? 'warn' : 'fail'
    case '=': {
      const d = Math.abs(actual - t.value) / (t.value || 1)
      return d <= 0.02 ? 'pass' : d <= W ? 'warn' : 'fail'
    }
    case 'range': {
      if (t.valueMax == null) return 'no-data'
      if (actual >= t.value && actual <= t.valueMax) return 'pass'
      const lo = actual >= t.value * (1 - W), hi = actual <= t.valueMax * (1 + W)
      return lo && hi ? 'warn' : 'fail'
    }
    default: return 'no-data'
  }
}

/**
 * Convert a value expressed in `fromUnit` to `toUnit`. Returns null when the
 * pair is not a known compatible conversion (e.g. g → IU). Recognizes:
 *   mass: g ↔ mg ↔ mcg
 *   energy: kcal ↔ kJ
 * Identity (same unit) returns the input unchanged.
 */
export function convertToUnit(value: number, fromUnit: string, toUnit: string): number | null {
  if (fromUnit === toUnit) return value
  const mass = (v: number, f: string, t: string): number | null => {
    const toG: Record<string, number> = { g: 1, mg: 1e-3, mcg: 1e-6 }
    if (!(f in toG) || !(t in toG)) return null
    return v * (toG[f] / toG[t])
  }
  if (fromUnit === 'kcal' && toUnit === 'kJ') return value * 4.184
  if (fromUnit === 'kJ'  && toUnit === 'kcal') return value / 4.184
  return mass(value, fromUnit, toUnit)
}

export function fmtRequirement(t: ProjectTarget): string {
  const v = `${t.value} ${t.unit}`
  if (t.comparator === '>=') return `≥ ${v}`
  if (t.comparator === '<=') return `≤ ${v}`
  if (t.comparator === '=') return `= ${v}`
  if (t.comparator === 'range') return `${t.value} – ${t.valueMax ?? '?'} ${t.unit}`
  return v
}

/**
 * Evaluate every project target against the calculated nutrient results.
 * `actual` is the per-100 g (or per-serving) value converted into the target's
 * unit (`t.unit`), or null when it cannot be determined (no matching nutrient,
 * missing serving size, or incompatible units).
 */
export function evaluateTargets(
  targets: ProjectTarget[],
  results: NutrientResult[],
  serving: number | undefined,
): Array<{ t: ProjectTarget; status: ValidationStatus; actual: number | null }> {
  return targets.map(t => ({
    t,
    status: validateTarget(t, results, serving),
    actual: resolveActual(t, results, serving),
  }))
}
