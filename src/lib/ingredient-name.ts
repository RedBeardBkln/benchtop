// One house style for ingredient names: every word starts with a capital letter. Pure — used by
// every API route that creates or renames a library ingredient.
//
// "tapioca starch, native" → "Tapioca Starch, Native"; "all-purpose flour" → "All-Purpose Flour".
// Words that already carry a capital are left alone, so "pH" or "DATEM" survive. A label written
// in all caps ("TAPIOCA STARCH") is recased word by word, keeping known abbreviations ("MCT Oil").

// Kept in capitals; also capitalized when typed in lowercase ("mct oil" → "MCT Oil")
const ACRONYMS = new Set([
  'MCT', 'USP', 'NF', 'FCC', 'GMO', 'IQF', 'DATEM', 'CMC', 'MCC', 'HPMC', 'HFCS', 'TBHQ', 'BHA', 'BHT',
  'EDTA', 'DHA', 'EPA', 'WPC', 'WPI', 'MPC', 'NFDM', 'SMP', 'WMP', 'FOS', 'GOS', 'MSG', 'SAPP', 'SALP',
  'TSPP', 'PGPR', 'SSL', 'CSL', 'HMO', 'CLA', 'CFU', 'MK', 'II', 'III', 'IV',
])
// Real words too, so only kept when the label already has them in capitals ("Maltodextrin 10 DE")
const CAPS_ONLY_ACRONYMS = new Set(['DE', 'ALA', 'ARA', 'TCP', 'DCP', 'MCP', 'PE'])
// Units written after a number or a slash keep their own case
const UNITS: Record<string, string> = {
  mg: 'mg', mcg: 'mcg', µg: 'µg', ug: 'µg', g: 'g', kg: 'kg', ml: 'mL', l: 'L', iu: 'IU', oz: 'oz', lb: 'lb', lbs: 'lbs',
}

export function formatIngredientName(raw: string): string {
  const s = raw.normalize('NFC').replace(/\s+/g, ' ').trim()
  const allCaps = !/\p{Ll}/u.test(s)

  return s.replace(/[\p{L}\p{N}'’]+/gu, (word: string, offset: number) => {
    const upper = word.toUpperCase()
    const isCaps = word === upper
    if (ACRONYMS.has(upper) || (isCaps && CAPS_ONLY_ACRONYMS.has(upper))) return upper
    if (/^\d/.test(word)) return word // "42DE", "1000mcg"
    const unit = UNITS[word.toLowerCase()]
    if (unit && /(\d ?|\/)$/.test(s.slice(0, offset))) return unit // "500 mg", "IU/g"
    if (!allCaps && /\p{Lu}/u.test(word)) return word // already styled: "pH", "McCormick"
    const lower = allCaps ? word.toLowerCase() : word
    return lower.charAt(0).toUpperCase() + lower.slice(1)
  })
}
