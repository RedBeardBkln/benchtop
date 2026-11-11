// The built-in PDF fonts only cover Windows-1252. Swap common characters outside it for close equivalents
// (Greek letters, common in ingredient names, are spelled out: β-glucan → beta-glucan), mark any other
// letter with "?" so the loss is visible, and drop emoji, symbols and invisible marks.
const SWAPS: Record<string, string> = {
  '≤': '<=', '≥': '>=', '≈': '~', '≠': '!=', '−': '-', '‑': '-', '→': '->', '←': '<-', '✓': 'v', '✔': 'v',
  '✗': 'x', '✘': 'x', '′': "'", '″': '"', ' ': ' ', ' ': ' ', ' ': ' ',
}
const GREEK: Record<string, string> = {
  α: 'alpha', β: 'beta', γ: 'gamma', δ: 'delta', ε: 'epsilon', ζ: 'zeta', η: 'eta', θ: 'theta', ι: 'iota',
  κ: 'kappa', λ: 'lambda', μ: 'µ', ν: 'nu', ξ: 'xi', ο: 'omicron', π: 'pi', ρ: 'rho', σ: 'sigma', ς: 'sigma',
  τ: 'tau', υ: 'upsilon', φ: 'phi', χ: 'chi', ψ: 'psi', ω: 'omega', Δ: 'Delta', Σ: 'Sigma', Ω: 'Omega',
}
const CP1252_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ')

/** Not worth a "?": punctuation and invisible marks, arrows and symbols, variation selectors, emoji */
const droppable = (code: number) =>
  (code >= 0x2000 && code <= 0x206f) || (code >= 0x2190 && code <= 0x2bff) ||
  (code >= 0xfe00 && code <= 0xfe0f) || code >= 0x1f000 || code < 0x20

export function pdfSafe(s: string): string {
  let out = ''
  for (const ch of s) {
    const swap = SWAPS[ch] ?? GREEK[ch]
    if (swap !== undefined) { out += swap; continue }
    const code = ch.codePointAt(0)!
    if (ch === '\n' || ch === '\t' || (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || CP1252_EXTRA.has(ch)) out += ch
    else if (!droppable(code)) out += '?'
  }
  return out
}

// Characters XML 1.0 forbids (control characters pasted from other apps): Word and Excel refuse a file containing them
export const xmlSafe = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
