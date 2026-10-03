// How many decimals the formula "%" column shows. A per-browser view preference (also used by the
// print view), starting at 1 and going up three more places to 4.
export const PCT_DECIMALS_MIN = 1
export const PCT_DECIMALS_MAX = 4
const KEY = 'pctDecimals'

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
