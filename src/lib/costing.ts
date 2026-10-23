// Raw material costing: an ingredient's cost per kg, and a formulation's COGS built from it.
// Pure functions; the API and UI share them.

import type { CostUnit } from './preferences'

/** kg in one of each mass unit a price can be quoted in */
export const KG_PER_UNIT: Record<string, number> = {
  kg: 1,
  g: 0.001,
  lb: 0.45359237,
  oz: 0.028349523125,
  mt: 1000,
}

export const KG_PER_LB = KG_PER_UNIT.lb

/** Price per `unit` → price per kg; null when the unit isn't a mass unit (case, drum, L…) */
export function pricePerKg(price: number, unit: string | null | undefined): number | null {
  const kg = unit ? KG_PER_UNIT[unit] : undefined
  return kg ? price / kg : null
}

/** Price per kg → price per kg or lb, for display */
export function fromPerKg(perKg: number, unit: CostUnit): number {
  return unit === 'lb' ? perKg * KG_PER_LB : perKg
}

/** Price per kg or lb → price per kg, for storage */
export function toPerKg(price: number, unit: CostUnit): number {
  return unit === 'lb' ? price / KG_PER_LB : price
}

export type CostLink = {
  id: string
  supplierName: string
  packUnit: string | null
  costPerUnit: string | number | null
  useForCost: boolean
}

export type IngredientCost =
  | { perKg: number; source: 'supplier'; supplierName: string; linkId: string }
  | { perKg: number; source: 'manual' }

/** Why the chosen supplier price couldn't be used, if it couldn't */
export type CostWarning = 'supplier-price-missing' | 'supplier-unit-not-mass' | null

const num = (v: string | number | null | undefined) =>
  v == null || v === '' ? null : typeof v === 'number' ? v : parseFloat(v)

/**
 * The cost a formulation uses for an ingredient: the supplier price marked "use for cost" when it
 * converts to a per-kg price, otherwise the manually entered cost per kg, otherwise none.
 */
export function resolveIngredientCost(
  manualPerKg: string | number | null | undefined,
  links: CostLink[],
): { cost: IngredientCost | null; warning: CostWarning } {
  const chosen = links.find(l => l.useForCost)
  let warning: CostWarning = null
  if (chosen) {
    const price = num(chosen.costPerUnit)
    const perKg = price != null ? pricePerKg(price, chosen.packUnit) : null
    if (perKg != null && perKg > 0) {
      return { cost: { perKg, source: 'supplier', supplierName: chosen.supplierName, linkId: chosen.id }, warning }
    }
    warning = price == null ? 'supplier-price-missing' : 'supplier-unit-not-mass'
  }
  const manual = num(manualPerKg)
  return { cost: manual != null && manual > 0 ? { perKg: manual, source: 'manual' } : null, warning }
}

export type CogsLineInput = {
  key: string
  ingredientId: string
  name: string
  weightG: number
}

export type CogsLine = CogsLineInput & {
  pct: number
  perKg: number | null
  cost: number | null
  /** Share of the costed batch total, 0–100 */
  sharePct: number | null
}

export type Cogs = {
  lines: CogsLine[]
  totalWeightG: number
  finishedWeightG: number
  /** Sum of the lines that have a cost */
  batchCost: number
  missingCount: number
  /** Per kg of finished product, after yield loss */
  perKgFinished: number | null
  perServing: number | null
  perUnit: number | null
  unitsPerBatch: number | null
}

/**
 * Raw materials COGS. Line costs are on the weights put in; per-kg, per-serving and per-unit
 * figures divide by the finished weight, so process loss raises them. Lines without a cost are
 * left out of the totals and counted in `missingCount`.
 */
export function computeCogs(opts: {
  lines: CogsLineInput[]
  costPerKg: (ingredientId: string) => number | null
  finishedWeightG: number
  servingSizeG?: number | null
  unitSizeG?: number | null
}): Cogs {
  const totalWeightG = opts.lines.reduce((s, l) => s + l.weightG, 0)
  const priced = opts.lines.map(l => {
    const perKg = opts.costPerKg(l.ingredientId)
    return {
      ...l,
      pct: totalWeightG > 0 ? (l.weightG / totalWeightG) * 100 : 0,
      perKg,
      cost: perKg != null ? (l.weightG / 1000) * perKg : null,
    }
  })
  const batchCost = priced.reduce((s, l) => s + (l.cost ?? 0), 0)
  const lines = priced.map(l => ({
    ...l,
    sharePct: l.cost != null && batchCost > 0 ? (l.cost / batchCost) * 100 : null,
  }))
  const finished = opts.finishedWeightG
  const per = (g: number | null | undefined) =>
    finished > 0 && g != null && g > 0 ? (batchCost * g) / finished : null
  return {
    lines,
    totalWeightG,
    finishedWeightG: finished,
    batchCost,
    missingCount: lines.filter(l => l.cost == null).length,
    perKgFinished: per(1000),
    perServing: per(opts.servingSizeG),
    perUnit: per(opts.unitSizeG),
    unitsPerBatch: finished > 0 && opts.unitSizeG && opts.unitSizeG > 0 ? finished / opts.unitSizeG : null,
  }
}

/** $1,234.56; small amounts (per serving) keep enough decimals to be meaningful */
export function formatMoney(v: number): string {
  const abs = Math.abs(v)
  const digits = abs > 0 && abs < 1 ? (abs < 0.01 ? 4 : 3) : 2
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: digits })
}
