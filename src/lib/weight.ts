// Ingredient weights are stored as numeric(12,4): up to four digits after the decimal point.
export const WEIGHT_DECIMALS = 4

/**
 * Display a weight in grams exactly as entered: up to four decimals, trailing zeros dropped,
 * and never rounded to fewer places (12.5 → "12.5", 0.1235 → "0.1235").
 */
export function formatWeightG(n: number): string {
  return String(Number(n.toFixed(WEIGHT_DECIMALS)))
}

/** True for text that is a (possibly partially typed) weight: digits with at most four after the point. */
export function isWeightInput(raw: string): boolean {
  return new RegExp(`^\\d*\\.?\\d{0,${WEIGHT_DECIMALS}}$`).test(raw)
}

/** True when a number has no more than four decimal places (tolerating float noise). */
export function hasValidWeightPrecision(n: number): boolean {
  const scaled = n * 10 ** WEIGHT_DECIMALS
  return Number.isFinite(scaled) && Math.abs(scaled - Math.round(scaled)) < 1e-6
}
