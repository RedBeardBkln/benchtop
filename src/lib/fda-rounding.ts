// FDA Nutrition Facts rounding rules (21 CFR 101.9) — pure, testable, no side effects.
//
// This file is the single source of truth for the rules: the label renderers apply them through
// `declareAmount` / `declareDvPct` / etc., and the "which rule was applied?" hover text is produced
// from the very same rule objects, so the explanation can never drift from the arithmetic.
//
// Bump RULES_VERSION whenever a threshold or increment below changes. Saved panels record the
// version they were built with.

export const RULES_VERSION = '2026-10'

/** Round half up (FDA: values exactly halfway between increments round up). Float-safe. */
export function roundToIncrement(value: number, increment: number): number {
  const steps = Math.floor(value / increment + 0.5 + 1e-9)
  // Re-round to kill float noise like 0.30000000000000004
  return Number((steps * increment).toFixed(6))
}

// ─── Amount rules ───────────────────────────────────────────────────────────

export type Band =
  | { kind: 'zero'; below: number }
  | { kind: 'lessThan'; below: number; text: string }
  | { kind: 'increment'; upTo: number; upToInclusive?: boolean; increment: number }

export type AmountRule = {
  id: string
  title: string
  /** Nutrient names (as stored in `nutrients.name`) this rule governs */
  names: string[]
  unit: string
  citation: string
  /** Bands are evaluated in order; the last must be an open-ended `increment` (upTo: Infinity) */
  bands: Band[]
  note?: string
}

const CFR = '21 CFR 101.9'

export const AMOUNT_RULES: AmountRule[] = [
  {
    id: 'calories',
    title: 'Calories',
    names: ['Energy'],
    unit: 'cal',
    citation: `${CFR}(c)(1)`,
    bands: [
      { kind: 'zero', below: 5 },
      { kind: 'increment', upTo: 50, upToInclusive: true, increment: 5 },
      { kind: 'increment', upTo: Infinity, increment: 10 },
    ],
  },
  {
    id: 'fat',
    title: 'Fats',
    names: ['Total Fat', 'Saturated Fat', 'Trans Fat', 'Polyunsaturated Fat', 'Monounsaturated Fat'],
    unit: 'g',
    citation: `${CFR}(c)(2)`,
    bands: [
      { kind: 'zero', below: 0.5 },
      { kind: 'increment', upTo: 5, increment: 0.5 },
      { kind: 'increment', upTo: Infinity, increment: 1 },
    ],
  },
  {
    id: 'cholesterol',
    title: 'Cholesterol',
    names: ['Cholesterol'],
    unit: 'mg',
    citation: `${CFR}(c)(3)`,
    bands: [
      { kind: 'zero', below: 2 },
      { kind: 'lessThan', below: 5, text: '<5' },
      { kind: 'increment', upTo: Infinity, increment: 5 },
    ],
    note: 'Amounts of 2 to 5 mg are shown as “less than 5 mg” (permitted by the regulation).',
  },
  {
    id: 'sodium',
    title: 'Sodium',
    names: ['Sodium'],
    unit: 'mg',
    citation: `${CFR}(c)(4)`,
    bands: [
      { kind: 'zero', below: 5 },
      { kind: 'increment', upTo: 140, upToInclusive: true, increment: 5 },
      { kind: 'increment', upTo: Infinity, increment: 10 },
    ],
  },
  {
    id: 'carb-protein',
    title: 'Carbohydrate, fiber, sugars and protein',
    names: ['Total Carbohydrate', 'Dietary Fiber', 'Total Sugars', 'Added Sugars', 'Protein'],
    unit: 'g',
    citation: `${CFR}(c)(6)–(7)`,
    bands: [
      { kind: 'zero', below: 0.5 },
      { kind: 'lessThan', below: 1, text: '<1' },
      { kind: 'increment', upTo: Infinity, increment: 1 },
    ],
    note: 'Amounts from 0.5 g up to 1 g are shown as “less than 1 g” (permitted by the regulation).',
  },
  {
    id: 'vitamin-d',
    title: 'Vitamin D',
    names: ['Vitamin D'],
    unit: 'mcg',
    citation: `${CFR}(c)(8)(iii) and FDA quantitative-amount guidance`,
    bands: [{ kind: 'increment', upTo: Infinity, increment: 0.1 }],
  },
  {
    id: 'calcium',
    title: 'Calcium',
    names: ['Calcium'],
    unit: 'mg',
    citation: `${CFR}(c)(8)(iii) and FDA quantitative-amount guidance`,
    bands: [{ kind: 'increment', upTo: Infinity, increment: 10 }],
  },
  {
    id: 'iron',
    title: 'Iron',
    names: ['Iron'],
    unit: 'mg',
    citation: `${CFR}(c)(8)(iii) and FDA quantitative-amount guidance`,
    bands: [{ kind: 'increment', upTo: Infinity, increment: 0.1 }],
  },
  {
    id: 'potassium',
    title: 'Potassium',
    names: ['Potassium'],
    unit: 'mg',
    citation: `${CFR}(c)(8)(iii) and FDA quantitative-amount guidance`,
    bands: [{ kind: 'increment', upTo: Infinity, increment: 10 }],
  },
]

export function ruleForNutrient(name: string): AmountRule | undefined {
  return AMOUNT_RULES.find(r => r.names.includes(name))
}

function bandMatches(band: Band, v: number): boolean {
  if (band.kind === 'increment') return band.upToInclusive ? v <= band.upTo : v < band.upTo
  return v < band.below
}

function fmtNum(n: number): string {
  return String(Number(n.toFixed(6)))
}

/** Human description of one band, e.g. "0.5 to <5 g → nearest 0.5 g". Used in the tooltip. */
export function describeBands(rule: AmountRule): string[] {
  const u = rule.unit
  const lines: string[] = []
  let lower = 0
  let lowerInclusive = true
  for (const b of rule.bands) {
    if (b.kind === 'zero') {
      lines.push(`under ${fmtNum(b.below)} ${u} → declared as 0`)
      lower = b.below; lowerInclusive = true
    } else if (b.kind === 'lessThan') {
      lines.push(`${fmtNum(lower)} to under ${fmtNum(b.below)} ${u} → “less than ${b.text.replace('<', '')} ${u}”`)
      lower = b.below; lowerInclusive = true
    } else {
      let range: string
      if (b.upTo === Infinity) {
        range = lower === 0
          ? 'any amount'
          : lowerInclusive ? `${fmtNum(lower)} ${u} and above` : `over ${fmtNum(lower)} ${u}`
      } else {
        const upper = `${b.upToInclusive ? '' : 'under '}${fmtNum(b.upTo)} ${u}`
        range = lower === 0
          ? `up to ${b.upToInclusive ? 'and including ' : 'under '}${fmtNum(b.upTo)} ${u}`
          : lowerInclusive ? `${fmtNum(lower)} to ${upper}` : `over ${fmtNum(lower)} to ${upper}`
      }
      lines.push(`${range} → nearest ${fmtNum(b.increment)} ${u}`)
      lower = b.upTo; lowerInclusive = !b.upToInclusive
    }
  }
  return lines
}

export type AmountDeclaration = {
  ruleId: string
  /** Numeric declared value (0 for zero / "<" bands); what the label rounds to */
  declared: number
  /** Declared value as printed, e.g. "3.5", "<1", "0" (no unit) */
  text: string
  /** Index of the band that applied, for explanation */
  bandIndex: number
}

function incrementDecimals(inc: number): number {
  const s = fmtNum(inc)
  return s.includes('.') ? s.split('.')[1].length : 0
}

/** Apply an amount rule to an unrounded per-serving (or per-100g) value. */
export function declareAmount(rule: AmountRule, actual: number): AmountDeclaration {
  const v = Math.max(0, actual)
  const idx = Math.max(0, rule.bands.findIndex(b => bandMatches(b, v)))
  const band = rule.bands[idx]
  if (band.kind === 'zero') return { ruleId: rule.id, declared: 0, text: '0', bandIndex: idx }
  if (band.kind === 'lessThan') return { ruleId: rule.id, declared: 0, text: band.text, bandIndex: idx }
  const declared = roundToIncrement(v, band.increment)
  const text = declared.toFixed(incrementDecimals(band.increment)).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
  return { ruleId: rule.id, declared, text, bandIndex: idx }
}

// ─── %Daily Value ───────────────────────────────────────────────────────────

export type DvDeclaration = { ruleId: 'dv-whole' | 'dv-vitamin-mineral'; declared: number; actual: number; tier: string }

export const DV_RULES = {
  'dv-whole': {
    id: 'dv-whole',
    title: '% Daily Value (nutrients other than vitamins and minerals)',
    citation: `${CFR}(d)(7)(ii)`,
    lines: ['nearest whole percent'],
  },
  'dv-vitamin-mineral': {
    id: 'dv-vitamin-mineral',
    title: '% Daily Value (vitamins and minerals)',
    citation: `${CFR}(c)(8)(iii)`,
    lines: [
      'up to and including 10% → nearest 2%',
      'above 10% up to and including 50% → nearest 5%',
      'above 50% → nearest 10%',
    ],
  },
} as const

export const DV_CALC_NOTE =
  '%DV is calculated from the actual (unrounded) amount ÷ the Daily Value. The regulation permits ' +
  `using either the actual or the declared amount, applied consistently (${CFR}(d)(7)).`

/** %DV for a nutrient. `tiered` = vitamins/minerals (2/5/10 increments), otherwise nearest whole %. */
export function declareDvPct(amount: number, dailyValue: number, tiered: boolean): DvDeclaration {
  const actual = (Math.max(0, amount) / dailyValue) * 100
  if (!tiered) {
    return { ruleId: 'dv-whole', declared: roundToIncrement(actual, 1), actual, tier: 'nearest 1%' }
  }
  const inc = actual <= 10 ? 2 : actual <= 50 ? 5 : 10
  const tier = inc === 2 ? 'at or below 10% → nearest 2%' : inc === 5 ? 'above 10% to 50% → nearest 5%' : 'above 50% → nearest 10%'
  return { ruleId: 'dv-vitamin-mineral', declared: roundToIncrement(actual, inc), actual, tier }
}

/** Nutrients whose %DV follows the vitamin/mineral tiers (mandatory four plus voluntary vitamin/mineral rows). */
export const DV_TIERED_NAMES = new Set(['Vitamin D', 'Calcium', 'Iron', 'Potassium'])

export function isDvTiered(name: string, category?: string): boolean {
  if (DV_TIERED_NAMES.has(name)) return true
  if (name === 'Sodium' || name === 'Cholesterol') return false
  return category === 'vitamins' || category === 'minerals'
}

// ─── Serving declarations ───────────────────────────────────────────────────

export const SERVING_SIZE_RULE = {
  id: 'serving-size',
  title: 'Serving size (metric)',
  citation: `${CFR}(b)(7)(ii)`,
  lines: ['under 2 g → nearest 0.1 g', '2 g to under 5 g → nearest 0.5 g', '5 g and above → nearest whole gram'],
} as const

export function declareServingSize(g: number): { text: string; declared: number; tier: string } {
  const inc = g < 2 ? 0.1 : g < 5 ? 0.5 : 1
  const declared = roundToIncrement(g, inc)
  const tier = inc === 0.1 ? 'under 2 g → nearest 0.1 g' : inc === 0.5 ? '2 g to under 5 g → nearest 0.5 g' : '5 g and above → nearest whole gram'
  return { declared, text: `${fmtNum(declared)}g`, tier }
}

export const SERVINGS_PER_CONTAINER_RULE = {
  id: 'servings-per-container',
  title: 'Servings per container',
  citation: `${CFR}(b)(8)(i)–(ii)`,
  lines: [
    'nearest whole number',
    'between 2 and 5 servings → nearest 0.5 serving',
    'a rounded figure is preceded by “about”',
  ],
} as const

export function declareServings(n: number): { text: string; declared: number; rounded: boolean; tier: string } {
  const inc = n >= 2 && n < 5 ? 0.5 : 1
  const declared = Math.max(1, roundToIncrement(n, inc))
  const rounded = Math.abs(declared - n) > 1e-6
  return {
    declared,
    rounded,
    text: `${rounded ? 'about ' : ''}${fmtNum(declared)}`,
    tier: inc === 0.5 ? 'between 2 and 5 servings → nearest 0.5' : 'nearest whole number',
  }
}

// ─── Reference listing (for the in-app rules panel) ─────────────────────────

export type RuleReference = { id: string; title: string; citation: string; lines: string[]; note?: string }

export function ruleReferences(): RuleReference[] {
  return [
    ...AMOUNT_RULES.map(r => ({ id: r.id, title: r.title, citation: r.citation, lines: describeBands(r), note: r.note })),
    { id: DV_RULES['dv-whole'].id, title: DV_RULES['dv-whole'].title, citation: DV_RULES['dv-whole'].citation, lines: [...DV_RULES['dv-whole'].lines] },
    { id: DV_RULES['dv-vitamin-mineral'].id, title: DV_RULES['dv-vitamin-mineral'].title, citation: DV_RULES['dv-vitamin-mineral'].citation, lines: [...DV_RULES['dv-vitamin-mineral'].lines], note: DV_CALC_NOTE },
    { id: SERVING_SIZE_RULE.id, title: SERVING_SIZE_RULE.title, citation: SERVING_SIZE_RULE.citation, lines: [...SERVING_SIZE_RULE.lines] },
    { id: SERVINGS_PER_CONTAINER_RULE.id, title: SERVINGS_PER_CONTAINER_RULE.title, citation: SERVINGS_PER_CONTAINER_RULE.citation, lines: [...SERVINGS_PER_CONTAINER_RULE.lines] },
  ]
}
