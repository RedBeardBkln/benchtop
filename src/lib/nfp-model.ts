// Builds a Nutrition Facts Panel "model": every printed string, already FDA-rounded, together with a
// frozen explanation of which rule produced it. Renderers (React panel, canvas download) only draw
// the model, and a saved panel is exactly this JSON — so what was approved is what is re-displayed,
// even if ingredient data or the rounding rules change later.

import { z } from 'zod'
import type { NutrientResult } from '@/lib/formulation-calc'
import type { StatementItem } from '@/lib/label-statements'
import {
  AMOUNT_RULES, DV_CALC_NOTE, DV_RULES, RULES_VERSION, SERVINGS_PER_CONTAINER_RULE, SERVING_SIZE_RULE,
  declareAmount, declareDvPct, declareServingSize, declareServings, describeBands, isDvTiered,
  ruleForNutrient, type AmountRule,
} from '@/lib/fda-rounding'

// ─── Schema (also validates saved panels on their way into the database) ────

const str = (max: number) => z.string().max(max)

const appliedRuleSchema = z.object({
  ruleId: str(64),
  title: str(200),
  citation: str(200),
  actual: str(64),
  declared: str(64),
  applied: str(600),
  lines: z.array(str(300)).max(12),
  note: str(600).optional(),
})

const rowSchema = z.object({
  key: str(64),
  label: str(120),
  labelBold: z.boolean(),
  layout: z.enum(['standard', 'trans', 'added']),
  indent: z.number().int().min(0).max(64),
  section: z.enum(['main', 'vitamins', 'extras']),
  amount: str(32),
  dvPct: str(16).optional(),
  amountRule: appliedRuleSchema.optional(),
  dvRule: appliedRuleSchema.optional(),
})

// FDA-permitted Nutrition Facts formats (21 CFR 101.9(d)(11)(iii), 101.9(j)(13)(ii)(A))
export const NFP_LAYOUTS = ['standard', 'tabular', 'linear'] as const
export type NfpLayout = (typeof NFP_LAYOUTS)[number]

export const NFP_LAYOUT_INFO: Record<NfpLayout, { label: string; description: string; citation: string }> = {
  standard: {
    label: 'Standard (vertical)',
    description: 'The default vertical format.',
    citation: '21 CFR 101.9(d)(12)',
  },
  tabular: {
    label: 'Tabular',
    description: 'Side-by-side columns, for packages without room for the vertical format.',
    citation: '21 CFR 101.9(d)(11)(iii)',
  },
  linear: {
    label: 'Linear',
    description: 'One running paragraph with permitted abbreviations, for small packages (under 40 sq in) without room for the tabular format.',
    citation: '21 CFR 101.9(j)(13)(ii)(A)(2)',
  },
}

export const nfpModelSchema = z.object({
  rulesVersion: str(32),
  // Absent on panels saved before layouts existed, which were all standard
  layout: z.enum(NFP_LAYOUTS).optional(),
  perServing: z.boolean(),
  basisLabel: str(64),
  servingsText: str(120),
  // e.g. "1 container (150g)"; the household measure is typed in, so it gets room
  servingSizeText: str(160),
  calories: str(16),
  caloriesRule: appliedRuleSchema,
  servingsRule: appliedRuleSchema.optional(),
  servingSizeRule: appliedRuleSchema.optional(),
  rows: z.array(rowSchema).max(120),
  allergenStatement: str(2000).optional(),
  ingredientStatement: str(6000).optional(),
})

export type AppliedRule = z.infer<typeof appliedRuleSchema>
export type NfpRow = z.infer<typeof rowSchema>
export type NfpModel = z.infer<typeof nfpModelSchema>

const statementItemSchema: z.ZodType<StatementItem> = z.lazy(() => z.object({
  id: str(64),
  name: str(500),
  weightG: z.number().finite(),
  subs: z.array(str(500)).max(100),
  children: z.array(statementItemSchema).max(100),
}))

/** Panel options remembered with a saved panel so the dialog can restore its settings. */
export const nfpOptionsSchema = z.object({
  hideZeros: z.boolean().default(false),
  showExtras: z.boolean().default(false),
  selectedExtras: z.array(str(120)).max(100).default([]),
  includeAllergen: z.boolean().default(false),
  allergenText: str(2000).default(''),
  includeIngredients: z.boolean().default(false),
  ingredientText: str(6000).default(''),
  // The arranged ingredient statement (order and combined groups); absent on panels saved before it existed
  ingredientItems: z.array(statementItemSchema).max(300).optional(),
  // True when the statement was typed by hand instead of arranged as a list
  ingredientCustomText: z.boolean().optional(),
  layout: z.enum(NFP_LAYOUTS).default('standard'),
  // Common household measure printed before the gram weight, e.g. "1 container", "2/3 cup"; absent = the default
  householdMeasure: str(120).optional(),
  // %DV for protein (voluntary unless a protein claim is made), from protein corrected by its PDCAAS
  proteinDv: z.boolean().default(false),
  pdcaas: z.number().min(0).max(1).optional(),
})
export type NfpOptions = z.infer<typeof nfpOptionsSchema>

// ─── Builder ────────────────────────────────────────────────────────────────

export type ExtraNutrientInput = {
  name: string
  value: number
  unit: string
  category?: string
  dailyValue: number | null
}

export type BuildNfpInput = {
  servingSizeG: number | undefined
  servingsPerContainer: number | undefined
  /**
   * Household measure for the serving size, e.g. "2/3 cup" (21 CFR 101.9(b)(5)). undefined uses the
   * default, "1 container" when the package is exactly one serving; "" prints the gram weight alone.
   */
  householdMeasure?: string
  /**
   * Protein Digestibility Corrected Amino Acid Score (0–1). When set, Protein gets a %DV, worked out
   * from protein × PDCAAS as 21 CFR 101.9(c)(7)(ii) requires; otherwise Protein has no %DV.
   */
  proteinPdcaas?: number
  results: NutrientResult[]
  hideZeros?: boolean
  layout?: NfpLayout
  extras?: ExtraNutrientInput[]
  allergenStatement?: string
  ingredientStatement?: string
}

type RowSpec = {
  name: string
  unit: string
  label?: string
  bold: boolean
  indent: number
  layout: NfpRow['layout']
  section: NfpRow['section']
  hasDv: boolean
  /** Voluntary rows are dropped when they declare as zero, regardless of hideZeros */
  voluntary?: boolean
}

const ROW_SPECS: RowSpec[] = [
  { name: 'Total Fat', unit: 'g', bold: true, indent: 0, layout: 'standard', section: 'main', hasDv: true },
  { name: 'Saturated Fat', unit: 'g', bold: false, indent: 16, layout: 'standard', section: 'main', hasDv: true },
  { name: 'Trans Fat', unit: 'g', bold: false, indent: 16, layout: 'trans', section: 'main', hasDv: false },
  { name: 'Polyunsaturated Fat', unit: 'g', bold: false, indent: 16, layout: 'standard', section: 'main', hasDv: false, voluntary: true },
  { name: 'Monounsaturated Fat', unit: 'g', bold: false, indent: 16, layout: 'standard', section: 'main', hasDv: false, voluntary: true },
  { name: 'Cholesterol', unit: 'mg', bold: true, indent: 0, layout: 'standard', section: 'main', hasDv: true },
  { name: 'Sodium', unit: 'mg', bold: true, indent: 0, layout: 'standard', section: 'main', hasDv: true },
  { name: 'Total Carbohydrate', unit: 'g', bold: true, indent: 0, layout: 'standard', section: 'main', hasDv: true },
  { name: 'Dietary Fiber', unit: 'g', bold: false, indent: 16, layout: 'standard', section: 'main', hasDv: true },
  { name: 'Total Sugars', unit: 'g', bold: false, indent: 16, layout: 'standard', section: 'main', hasDv: false },
  { name: 'Added Sugars', unit: 'g', bold: false, indent: 32, layout: 'added', section: 'main', hasDv: true },
  { name: 'Protein', unit: 'g', bold: true, indent: 0, layout: 'standard', section: 'main', hasDv: false },
  { name: 'Vitamin D', unit: 'mcg', bold: false, indent: 0, layout: 'standard', section: 'vitamins', hasDv: true },
  { name: 'Calcium', unit: 'mg', bold: false, indent: 0, layout: 'standard', section: 'vitamins', hasDv: true },
  { name: 'Iron', unit: 'mg', bold: false, indent: 0, layout: 'standard', section: 'vitamins', hasDv: true },
  { name: 'Potassium', unit: 'mg', bold: false, indent: 0, layout: 'standard', section: 'vitamins', hasDv: true },
]

export const STANDARD_NFP_NAMES = new Set(['Energy', ...ROW_SPECS.map(s => s.name)])

/** Readable precision for voluntary nutrients, which have no single FDA increment applied here. */
export function formatExtraAmount(value: number, unit: string): string {
  if (unit === 'g') return value.toFixed(1)
  if (value === 0) return '0'
  if (value < 0.1) return value.toFixed(2)
  if (value < 10) return value.toFixed(1)
  return Math.round(value).toString()
}

/** The panel prints its own "Contains:", so drop one typed (or saved) at the start of the statement. */
export function allergenBody(statement: string): string {
  return statement.replace(/^\s*contains\s*:?\s*/i, '')
}

// Abbreviations FDA permits in the tabular and linear formats (21 CFR 101.9(j)(13)(ii)(B))
const ABBREVIATIONS: Record<string, string> = {
  'Saturated Fat': 'Sat. Fat',
  'Polyunsaturated Fat': 'Polyunsat. Fat',
  'Monounsaturated Fat': 'Monounsat. Fat',
  'Cholesterol': 'Cholest.',
  'Total Carbohydrate': 'Total Carb.',
  'Dietary Fiber': 'Fiber',
  'Vitamin D': 'Vit. D',
  'Potassium': 'Potas.',
}
export const abbreviate = (label: string) => ABBREVIATIONS[label] ?? label

/** The tabular format's two nutrient columns: fats, cholesterol and sodium, then carbohydrates and protein. */
export function splitTabularRows(main: NfpRow[]): [NfpRow[], NfpRow[]] {
  const at = main.findIndex(r => r.key === 'Total Carbohydrate')
  if (at > 0) return [main.slice(0, at), main.slice(at)]
  const half = Math.ceil(main.length / 2)
  return [main.slice(0, half), main.slice(half)]
}

const sig = (n: number) => String(Number(n.toPrecision(4)))

function amountRuleExplanation(rule: AmountRule, actual: number, text: string, bandIndex: number, perServing: boolean): AppliedRule {
  const unit = rule.unit
  const declaredText = `${text} ${unit}`
  const bands = describeBands(rule)
  const basis = perServing
    ? ''
    : ' No serving size is set, so the per-serving rule was applied to the per-100 g values.'
  return {
    ruleId: rule.id,
    title: rule.title,
    citation: rule.citation,
    actual: `${sig(actual)} ${unit}`,
    declared: declaredText,
    applied: `Actual ${sig(actual)} ${unit} falls in the band “${bands[bandIndex]}”, so it is declared as ${declaredText}.${basis}`,
    lines: bands,
    note: rule.note,
  }
}

function dvExplanation(name: string, amount: number, unit: string, dv: number, tiered: boolean): { text: string; rule: AppliedRule } {
  const d = declareDvPct(amount, dv, tiered)
  const def = DV_RULES[d.ruleId]
  return {
    text: `${d.declared}%`,
    rule: {
      ruleId: d.ruleId,
      title: def.title,
      citation: def.citation,
      actual: `${sig(d.actual)}%`,
      declared: `${d.declared}%`,
      applied: `${name}: ${sig(amount)} ${unit} ÷ DV ${sig(dv)} ${unit} = ${sig(d.actual)}% (${d.tier}) → ${d.declared}%.`,
      lines: [...def.lines],
      note: DV_CALC_NOTE,
    },
  }
}

/** Daily Value for protein, adults and children 4 years and over (21 CFR 101.9(c)(7)(iii)) */
export const PROTEIN_DV_G = 50

function proteinDvExplanation(protein: number, pdcaas: number, dv: number): { text: string; rule: AppliedRule } {
  const corrected = Math.max(0, protein) * pdcaas
  const d = declareDvPct(corrected, dv, false)
  return {
    text: `${d.declared}%`,
    rule: {
      ruleId: 'dv-protein',
      title: '% Daily Value (protein, PDCAAS-corrected)',
      citation: '21 CFR 101.9(c)(7)(ii)–(iii)',
      actual: `${sig(d.actual)}%`,
      declared: `${d.declared}%`,
      applied: `Protein: ${sig(protein)} g × PDCAAS ${sig(pdcaas)} = ${sig(corrected)} g corrected ÷ DV ${sig(dv)} g = ${sig(d.actual)}% → ${d.declared}%.`,
      lines: ['corrected protein = protein × PDCAAS', '%DV = corrected protein ÷ 50 g', 'nearest whole percent'],
      note: 'A protein %DV is required only when a protein claim is made or the food is for children under 4; otherwise it is voluntary. The amount in grams is still declared uncorrected.',
    },
  }
}

/** "1 container" when the package holds exactly one serving; otherwise none, since it depends on the food. */
export function defaultHouseholdMeasure(servingsPerContainer: number | undefined): string {
  if (servingsPerContainer == null) return ''
  const s = declareServings(servingsPerContainer)
  return s.declared === 1 && !s.rounded ? '1 container' : ''
}

/** carbs is null when the ingredient has sugars but no carbohydrate value */
export type SugarCarbIssue = { ingredientName: string; carbs: number | null; sugars: number; addedSugars: number }

/**
 * Ingredients whose data lists more sugars than carbohydrate, or more added sugars than total sugars
 * (per 100 g). Those can push the panel's sugars above its carbohydrate, which can't be right.
 */
export function sugarCarbIssues(
  lines: Array<{ ingredientName: string; nutrients?: Array<{ nutrientId: string; amountPer100g: number }> }>,
  results: Pick<NutrientResult, 'nutrientId' | 'name'>[],
): SugarCarbIssue[] {
  const id = (name: string) => results.find(r => r.name === name)?.nutrientId
  const [carbId, sugarId, addedId] = [id('Total Carbohydrate'), id('Total Sugars'), id('Added Sugars')]
  const seen = new Set<string>()
  const out: SugarCarbIssue[] = []
  for (const l of lines) {
    if (seen.has(l.ingredientName)) continue
    seen.add(l.ingredientName)
    const v = (nid: string | undefined) => l.nutrients?.find(n => n.nutrientId === nid)?.amountPer100g
    const carbs = v(carbId), sugars = v(sugarId), addedSugars = v(addedId) ?? 0
    const tooManySugars = sugars != null && (carbs == null ? sugars > 0 : sugars > carbs + 1e-9)
    const tooManyAdded = sugars != null && addedSugars > sugars + 1e-9
    if (tooManySugars || tooManyAdded) out.push({ ingredientName: l.ingredientName, carbs: carbs ?? null, sugars: sugars ?? 0, addedSugars })
  }
  return out
}

export function buildNfpModel(input: BuildNfpInput): NfpModel {
  const { servingSizeG, servingsPerContainer, results, hideZeros = false, extras = [] } = input
  const perServing = !!servingSizeG
  const byName = new Map(results.map(r => [r.name, r]))
  const rawAmount = (name: string) => {
    const r = byName.get(name)
    if (!r) return 0
    return perServing ? (r.perServing ?? 0) : r.perFinished100g
  }
  // Sugars are part of carbohydrate, and added sugars part of total sugars. Ingredient data can say
  // otherwise (supplier specs measure them by different methods), so the panel never declares more.
  const carbs = byName.has('Total Carbohydrate') ? rawAmount('Total Carbohydrate') : Infinity
  const sugars = Math.min(rawAmount('Total Sugars'), carbs)
  const added = Math.min(rawAmount('Added Sugars'), sugars)
  const capped: Record<string, { actual: number; limit: string } | undefined> = {
    'Total Sugars': rawAmount('Total Sugars') > carbs ? { actual: rawAmount('Total Sugars'), limit: 'Total Carbohydrate' } : undefined,
    'Added Sugars': rawAmount('Added Sugars') > sugars ? { actual: rawAmount('Added Sugars'), limit: 'Total Sugars' } : undefined,
  }
  const amountOf = (name: string) =>
    name === 'Total Sugars' ? sugars : name === 'Added Sugars' ? added : rawAmount(name)

  const rows: NfpRow[] = []
  for (const spec of ROW_SPECS) {
    const rule = ruleForNutrient(spec.name)!
    const actual = amountOf(spec.name)
    const decl = declareAmount(rule, actual)
    const isZero = decl.text === '0'
    if (spec.voluntary ? isZero : hideZeros && isZero) continue

    const result = byName.get(spec.name)
    const dv = result?.dailyValueAmount
    const row: NfpRow = {
      key: spec.name,
      label: spec.name,
      labelBold: spec.bold,
      layout: spec.layout,
      indent: spec.indent,
      section: spec.section,
      amount: `${decl.text}${spec.unit}`,
      amountRule: amountRuleExplanation(rule, actual, decl.text, decl.bandIndex, perServing),
    }
    const cap = capped[spec.name]
    if (cap && row.amountRule) {
      row.amountRule.applied =
        `The ingredient data adds up to ${sig(cap.actual)} ${spec.unit}, more than ${cap.limit} (${sig(actual)} ${spec.unit}), ` +
        `which it is part of, so ${sig(actual)} ${spec.unit} is used. ${row.amountRule.applied}`
    }
    if (spec.name === 'Protein' && input.proteinPdcaas != null) {
      const d = proteinDvExplanation(actual, input.proteinPdcaas, dv != null && dv > 0 ? dv : PROTEIN_DV_G)
      row.dvPct = d.text
      row.dvRule = d.rule
    } else if (spec.hasDv && dv != null && dv > 0) {
      const d = dvExplanation(spec.name, actual, spec.unit, dv, isDvTiered(spec.name, result?.category))
      row.dvPct = d.text
      row.dvRule = d.rule
    }
    rows.push(row)
  }

  for (const n of extras) {
    if (hideZeros && !(n.value > 0)) continue
    const row: NfpRow = {
      key: `extra:${n.name}`,
      label: n.name,
      labelBold: false,
      layout: 'standard',
      indent: 0,
      section: 'extras',
      amount: `${formatExtraAmount(n.value, n.unit)}${n.unit}`,
      amountRule: {
        ruleId: 'voluntary-display',
        title: 'Voluntary nutrient',
        citation: '21 CFR 101.9(c)(8)(iv)',
        actual: `${sig(n.value)} ${n.unit}`,
        declared: `${formatExtraAmount(n.value, n.unit)} ${n.unit}`,
        applied: 'Voluntary nutrient shown to a readable precision.',
        lines: ['grams → 1 decimal', 'under 0.1 → 2 decimals', 'under 10 → 1 decimal', '10 and above → whole number'],
        note: 'FDA lists specific “levels of significance” for voluntary vitamins and minerals; Benchtop does not apply those yet, so confirm this value before relying on it.',
      },
    }
    if (n.dailyValue != null && n.dailyValue > 0) {
      const d = dvExplanation(n.name, n.value, n.unit, n.dailyValue, isDvTiered(n.name, n.category))
      row.dvPct = d.text
      row.dvRule = d.rule
    }
    rows.push(row)
  }

  // Header: calories, serving size, servings per container
  const calRule = AMOUNT_RULES.find(r => r.id === 'calories')!
  const calActual = amountOf('Energy')
  const cal = declareAmount(calRule, calActual)

  let servingSizeText = '100g'
  let servingSizeRule: AppliedRule | undefined
  if (servingSizeG) {
    const s = declareServingSize(servingSizeG)
    const measure = (input.householdMeasure ?? defaultHouseholdMeasure(servingsPerContainer)).trim()
    servingSizeText = measure ? `${measure} (${s.text})` : s.text
    servingSizeRule = {
      ruleId: SERVING_SIZE_RULE.id,
      title: SERVING_SIZE_RULE.title,
      citation: SERVING_SIZE_RULE.citation,
      actual: `${sig(servingSizeG)} g`,
      declared: servingSizeText,
      applied: `Serving size ${sig(servingSizeG)} g (${s.tier}) → ${s.text.replace('g', ' g')}.` + (measure
        ? ` The household measure “${measure}” is printed first, with the metric amount in parentheses.`
        : ' No household measure is set. FDA requires one (such as “1 container” or “2/3 cup”) before the metric amount.'),
      lines: [...SERVING_SIZE_RULE.lines],
    }
  }

  let servingsText = 'Servings per container variable'
  let servingsRule: AppliedRule | undefined
  if (servingsPerContainer != null) {
    const s = declareServings(servingsPerContainer)
    servingsText = `${s.text} ${s.declared > 1 ? 'servings' : 'serving'} per container`
    servingsRule = {
      ruleId: SERVINGS_PER_CONTAINER_RULE.id,
      title: SERVINGS_PER_CONTAINER_RULE.title,
      citation: SERVINGS_PER_CONTAINER_RULE.citation,
      actual: sig(servingsPerContainer),
      declared: s.text,
      applied: `${sig(servingsPerContainer)} ${servingsPerContainer === 1 ? 'serving' : 'servings'} (${s.tier}) → ${s.text}.`,
      lines: [...SERVINGS_PER_CONTAINER_RULE.lines],
    }
  }

  return {
    rulesVersion: RULES_VERSION,
    layout: input.layout ?? 'standard',
    perServing,
    basisLabel: perServing ? 'Amount per serving' : 'Amount per 100g',
    servingsText,
    servingSizeText,
    calories: cal.text,
    caloriesRule: amountRuleExplanation(calRule, calActual, cal.text, cal.bandIndex, perServing),
    servingsRule,
    servingSizeRule,
    rows,
    allergenStatement: input.allergenStatement || undefined,
    ingredientStatement: input.ingredientStatement || undefined,
  }
}
