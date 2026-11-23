// How many decimals the formula's "%" and amount columns show. Per-browser view preferences (also used
// by the print view). Each line can also set its own, saved with the formula (formulation_lines
// pct_decimals / amount_decimals), which wins over the column's.

// Usage %: starts at 1 and goes up three more places to 4
export const PCT_DECIMALS_MIN = 1
export const PCT_DECIMALS_MAX = 4
// Amounts: null = automatic (as many as the unit holds, trailing zeros dropped); otherwise 0–4 fixed
// places, never more than the unit holds
export const AMOUNT_DECIMALS_MIN = 0
export const AMOUNT_DECIMALS_MAX = 4

const KEY = 'pctDecimals'
const AMOUNT_KEY = 'amountDecimals'

export function readPctDecimals(): number {
  try {
    const n = parseInt(window.localStorage.getItem(KEY) ?? '', 10)
    if (Number.isFinite(n)) return Math.min(PCT_DECIMALS_MAX, Math.max(PCT_DECIMALS_MIN, n))
  } catch { /* storage unavailable */ }
  return PCT_DECIMALS_MIN
}

export function writePctDecimals(n: number): void {
  try { window.localStorage.setItem(KEY, String(n)) } catch { /* storage unavailable */ }
}

export function readAmountDecimals(): number | null {
  try {
    const n = parseInt(window.localStorage.getItem(AMOUNT_KEY) ?? '', 10)
    if (Number.isFinite(n)) return Math.min(AMOUNT_DECIMALS_MAX, Math.max(AMOUNT_DECIMALS_MIN, n))
  } catch { /* storage unavailable */ }
  return null
}

export function writeAmountDecimals(n: number | null): void {
  try {
    if (n == null) window.localStorage.removeItem(AMOUNT_KEY)
    else window.localStorage.setItem(AMOUNT_KEY, String(n))
  } catch { /* storage unavailable */ }
}

/** A stored per-line decimals value, if it is one (else null = follow the column) */
export function lineDecimals(v: unknown, min: number, max: number): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null
}
