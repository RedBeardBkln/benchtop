// Builds a Nutrition Facts Panel "model": every printed string, already FDA-rounded, together with a
// frozen explanation of which rule produced it. Renderers (React panel, canvas download) only draw
// the model, and a saved panel is exactly this JSON — so what was approved is what is re-displayed,
// even if ingredient data or the rounding rules change later.

import { z } from 'zod'
import type { NutrientResult } from '@/lib/formulation-calc'
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

export const nfpModelSchema = z.object({
  rulesVersion: str(32),
  perServing: z.boolean(),
  basisLabel: str(64),
  servingsText: str(120),
  servingSizeText: str(32),
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

/** Panel options remembered with a saved panel so the dialog can restore its settings. */
export const nfpOptionsSchema = z.object({
  hideZeros: z.boolean().default(false),
  showExtras: z.boolean().default(false),
  selectedExtras: z.array(str(120)).max(100).default([]),
  includeAllergen: z.boolean().default(false),
  allergenText: str(2000).default(''),
  includeIngredients: z.boolean().default(false),
  ingredientText: str(6000).default(''),
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
  results: NutrientResult[]
  hideZeros?: boolean
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

export function buildNfpModel(input: BuildNfpInput): NfpModel {
  const { servingSizeG, servingsPerContainer, results, hideZeros = false, extras = [] } = input
  const perServing = !!servingSizeG
  const byName = new Map(results.map(r => [r.name, r]))
  const amountOf = (name: string) => {
    const r = byName.get(name)
    if (!r) return 0
    return perServing ? (r.perServing ?? 0) : r.perFinished100g
  }

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
    if (spec.hasDv && dv != null && dv > 0) {
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
    servingSizeText = s.text
    servingSizeRule = {
      ruleId: SERVING_SIZE_RULE.id,
      title: SERVING_SIZE_RULE.title,
      citation: SERVING_SIZE_RULE.citation,
      actual: `${sig(servingSizeG)} g`,
      declared: s.text.replace('g', ' g'),
      applied: `Serving size ${sig(servingSizeG)} g (${s.tier}) → ${s.text.replace('g', ' g')}.`,
      lines: [...SERVING_SIZE_RULE.lines],
    }
  }

  let servingsText = 'Servings per container variable'
  let servingsRule: AppliedRule | undefined
  if (servingsPerContainer != null) {
    const s = declareServings(servingsPerContainer)
    servingsText = `${s.text} servings per container`
    servingsRule = {
      ruleId: SERVINGS_PER_CONTAINER_RULE.id,
      title: SERVINGS_PER_CONTAINER_RULE.title,
      citation: SERVINGS_PER_CONTAINER_RULE.citation,
      actual: sig(servingsPerContainer),
      declared: s.text,
      applied: `${sig(servingsPerContainer)} servings (${s.tier}) → ${s.text}.`,
      lines: [...SERVINGS_PER_CONTAINER_RULE.lines],
    }
  }

  return {
    rulesVersion: RULES_VERSION,
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
