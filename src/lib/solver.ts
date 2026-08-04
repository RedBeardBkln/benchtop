// Server-only utility — runs via API route, never imported client-side.
// Uses javascript-lp-solver to find ingredient weights that satisfy nutritional targets
// while minimising L1 deviation from the current formula weights.
//
// LP formulation (variables: x_i = % of batch for each unlocked ingredient):
//   Minimise   Σ_i (dp_i + dn_i)          [L1 deviation from current weights]
//   Subject to Σ_i x_i = (100 - lockedSum) [unlocked ingredients sum to remaining %]
//              x_i - dp_i + dn_i = pct_i   [linearised absolute deviation]
//              x_i ≥ minPct_i              [per-ingredient lower bound]
//              x_i ≤ maxPct_i              [per-ingredient upper bound]
//              nutritional constraints from project targets

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Solver = require('javascript-lp-solver')

import type { ProjectTarget } from '@/lib/types'

export type SolverLine = {
  key: string
  ingredientName: string
  weightG: number
  locked: boolean
  minPct: number   // 0 if unset
  maxPct: number   // 100 if unset
  nutrients: Array<{ name: string; amountPer100g: number }>
}

export type SolverInput = {
  lines: SolverLine[]
  targets: ProjectTarget[]
  yieldPct: number          // e.g. 95 means 5% mass loss on processing
  servingSizeG: number | null
}

export type AuditEntry = {
  label: string
  requirement: string
  achieved: number | null
  unit: string
  slack: number | null      // positive = headroom; negative = shortfall
  status: 'satisfied' | 'binding' | 'violated' | 'no-data'
}

export type SolverResult = {
  status: 'optimal' | 'infeasible' | 'error'
  message?: string
  suggestedPcts: Record<string, number>  // line key → new percentage of batch
  auditTrace: AuditEntry[]
  solveTimeMs: number
}

function san(s: string): string {
  return s.replace(/[^a-zA-Z0-9_]/g, '_')
}

function fmtReq(t: ProjectTarget): string {
  const v = `${t.value} ${t.unit}`
  const basis = t.basis === 'per_serving' ? '/ serving' : '/ 100 g'
  if (t.comparator === '>=')    return `≥ ${v} ${basis}`
  if (t.comparator === '<=')    return `≤ ${v} ${basis}`
  if (t.comparator === '=')     return `= ${v} ${basis}`
  if (t.comparator === 'range') return `${t.value} – ${t.valueMax ?? '?'} ${t.unit} ${basis}`
  return `${v} ${basis}`
}

export function solve(input: SolverInput): SolverResult {
  const t0 = Date.now()

  const totalWeight = input.lines.reduce((s, l) => s + l.weightG, 0)
  if (totalWeight <= 0) {
    return { status: 'error', message: 'No weights entered in formulation.', suggestedPcts: {}, auditTrace: [], solveTimeMs: 0 }
  }

  const locked   = input.lines.filter(l => l.locked).map(l => ({ ...l, pct: (l.weightG / totalWeight) * 100 }))
  const unlocked = input.lines.filter(l => !l.locked).map(l => ({ ...l, pct: (l.weightG / totalWeight) * 100 }))

  if (unlocked.length === 0) {
    return { status: 'error', message: 'All ingredients are locked — unlock at least one.', suggestedPcts: {}, auditTrace: [], solveTimeMs: 0 }
  }

  const lockedPctSum = locked.reduce((s, l) => s + l.pct, 0)

  // Pre-compute locked nutrient contributions (per 100 g finished product)
  const lockedContrib = new Map<string, number>()
  for (const line of locked) {
    for (const n of line.nutrients) {
      const v = (n.amountPer100g * line.pct) / input.yieldPct
      lockedContrib.set(n.name, (lockedContrib.get(n.name) ?? 0) + v)
    }
  }

  // ── Build LP model ────────────────────────────────────────────────────────
  type LpModel = {
    optimize: string
    opType: 'min' | 'max'
    constraints: Record<string, { min?: number; max?: number; equal?: number }>
    variables: Record<string, Record<string, number>>
  }

  const model: LpModel = {
    optimize: 'obj',
    opType:   'min',
    constraints: {
      sum: { equal: 100 - lockedPctSum },
    },
    variables: {},
  }

  // Add ingredient variables + L1 deviation pairs
  for (const line of unlocked) {
    const k  = san(line.key)
    const xv  = `x_${k}`
    const dpv = `dp_${k}`
    const dnv = `dn_${k}`
    const dco = `dev_${k}` // deviation equality constraint

    model.variables[xv]  = { obj: 0, sum: 1, [dco]: 1 }
    model.variables[dpv] = { obj: 1, [dco]: -1 }
    model.variables[dnv] = { obj: 1, [dco]:  1 }
    model.constraints[dco] = { equal: line.pct }

    // Per-ingredient bounds
    if (line.minPct > 0) {
      const lbc = `lb_${k}`
      model.constraints[lbc] = { min: line.minPct }
      model.variables[xv][lbc] = 1
    }
    if (line.maxPct < 100) {
      const ubc = `ub_${k}`
      model.constraints[ubc] = { max: line.maxPct }
      model.variables[xv][ubc] = 1
    }

    // Nutrient coefficients — per 100 g finished = a_ij * x_i / yieldPct
    for (const n of line.nutrients) {
      const nc = san(n.name)
      model.variables[xv][nc] = (model.variables[xv][nc] ?? 0) + (n.amountPer100g / input.yieldPct)
    }
  }

  // Accumulate nutritional constraints (multiple targets on same nutrient are merged)
  const nutConstraints = new Map<string, { min?: number; max?: number }>()
  const nutRawName = new Map<string, string>()  // sanitized → original name

  for (const target of input.targets) {
    if (!target.nutrient) continue

    const nc    = san(target.nutrient)
    const lj    = lockedContrib.get(target.nutrient) ?? 0
    const bf    = (target.basis === 'per_serving' && input.servingSizeG)
                    ? input.servingSizeG / 100
                    : 1
    const v100  = target.value / bf          // target converted to per-100g-finished basis
    const vMax  = target.valueMax != null ? target.valueMax / bf : null
    const rhs   = v100 - lj                  // what unlocked ingredients must contribute

    const cur = nutConstraints.get(nc) ?? {}

    switch (target.comparator) {
      case '>=': cur.min = Math.max(cur.min ?? -Infinity, rhs);   break
      case '<=': cur.max = Math.min(cur.max ??  Infinity, rhs);   break
      case '=':  cur.min = Math.max(cur.min ?? -Infinity, rhs);
                 cur.max = Math.min(cur.max ??  Infinity, rhs);   break
      case 'range':
        if (vMax != null) {
          cur.min = Math.max(cur.min ?? -Infinity, rhs)
          cur.max = Math.min(cur.max ??  Infinity, vMax - lj)
        }
        break
    }
    nutConstraints.set(nc, cur)
    nutRawName.set(nc, target.nutrient)
  }

  for (const [nc, bounds] of nutConstraints) {
    model.constraints[nc] = bounds
  }

  // ── Solve ─────────────────────────────────────────────────────────────────
  let lpResult: Record<string, unknown>
  try {
    lpResult = Solver.Solve(model) as Record<string, unknown>
  } catch (err) {
    return { status: 'error', message: String(err), suggestedPcts: {}, auditTrace: [], solveTimeMs: Date.now() - t0 }
  }

  if (!lpResult.feasible) {
    return {
      status: 'infeasible',
      message: 'No combination of these ingredients can satisfy all targets simultaneously. Try relaxing a target or adding a different ingredient.',
      suggestedPcts: {},
      auditTrace: buildAuditTrace(input.targets, null, input.yieldPct, input.servingSizeG),
      solveTimeMs: Date.now() - t0,
    }
  }

  // Extract suggested percentages
  const suggestedPcts: Record<string, number> = {}
  for (const line of locked)   suggestedPcts[line.key] = line.pct
  for (const line of unlocked) {
    const xv = `x_${san(line.key)}`
    suggestedPcts[line.key] = Math.max(0, (lpResult[xv] as number) ?? 0)
  }

  // Compute achieved nutrients from suggested solution
  const achieved = new Map<string, number>()
  for (const line of [...locked, ...unlocked.map(l => ({ ...l, pct: suggestedPcts[l.key] }))]) {
    for (const n of line.nutrients) {
      achieved.set(n.name, (achieved.get(n.name) ?? 0) + (n.amountPer100g * line.pct / input.yieldPct))
    }
  }

  return {
    status: 'optimal',
    suggestedPcts,
    auditTrace: buildAuditTrace(input.targets, achieved, input.yieldPct, input.servingSizeG),
    solveTimeMs: Date.now() - t0,
  }
}

// ── Reverse-engineer solver ───────────────────────────────────────────────────
// Unlike solve() (which minimises weight deviation while hitting hard nutrient
// constraints), reverseSolve() minimises NUTRIENT deviation from a target label.
// Variables: x_i = % of each candidate ingredient, summing to 100.
// Objective: minimise Σ_j (ep_j + en_j) — L1 distance from each target value.
//
// Key technique: add deviation-from-start-point equalities (same pattern as
// solve()) so the LP always has a natural feasible starting basis — this
// eliminates the Phase-1 failures that occur when the solver has no obvious
// starting point for the simplex.

export type NutrientTarget = {
  name: string
  value: number
  unit: string
}

export type ReverseInput = {
  candidates: SolverLine[]
  targetNutrients: NutrientTarget[]
  yieldPct: number
  servingSizeG: number | null
}

export function reverseSolve(input: ReverseInput): SolverResult {
  const t0 = Date.now()

  if (input.candidates.length === 0)
    return { status: 'error', message: 'Select at least one candidate ingredient.', suggestedPcts: {}, auditTrace: [], solveTimeMs: 0 }

  const activeTargets = input.targetNutrients.filter(t => t.value > 0)
  if (activeTargets.length === 0)
    return { status: 'error', message: 'Enter at least one non-zero target nutrient value.', suggestedPcts: {}, auditTrace: [], solveTimeMs: 0 }

  // Pre-check: bounds feasibility (min% sum ≤ 100 ≤ max% sum)
  const minSum = input.candidates.reduce((s, c) => s + c.minPct, 0)
  const maxSum = input.candidates.reduce((s, c) => s + c.maxPct, 0)
  if (minSum > 100.001) {
    return {
      status: 'infeasible',
      message: `Minimum % bounds sum to ${minSum.toFixed(1)}% — they must total ≤ 100%. Lower the min bounds on some ingredients in the Link step.`,
      suggestedPcts: {}, auditTrace: [], solveTimeMs: Date.now() - t0,
    }
  }
  if (maxSum < 99.999) {
    return {
      status: 'infeasible',
      message: `Maximum % bounds sum to ${maxSum.toFixed(1)}% — they must total ≥ 100%. Raise the max bounds on some ingredients in the Link step.`,
      suggestedPcts: {}, auditTrace: [], solveTimeMs: Date.now() - t0,
    }
  }

  // Scale targets from per-serving to per-100g finished product
  const sg = input.servingSizeG
  const scaledTargets = activeTargets.map(t => ({
    ...t,
    value100g: sg ? (t.value / sg) * 100 : t.value,
  }))

  // ── Compute a guaranteed-feasible start blend ────────────────────────────
  // Allocate: x_i = minPct_i + (slack_i / totalSlack) * budget
  // Guarantees sum = 100 and minPct_i ≤ x_i ≤ maxPct_i (proven by pre-check).
  const budget     = 100 - minSum
  const totalSlack = input.candidates.reduce((s, c) => s + (c.maxPct - c.minPct), 0)
  const startPcts: Record<string, number> = {}
  for (const cand of input.candidates) {
    startPcts[cand.key] = cand.minPct +
      (totalSlack > 0 ? ((cand.maxPct - cand.minPct) / totalSlack) * budget : 0)
  }

  // ── Build LP model ────────────────────────────────────────────────────────
  // REG: tiny regularization weight for deviation from start point.
  // The nutrient-matching objective (weight=1) dominates by ~10,000×.
  const REG = 1e-4

  type LpModel = {
    optimize: string
    opType: 'min' | 'max'
    constraints: Record<string, { min?: number; max?: number; equal?: number }>
    variables: Record<string, Record<string, number>>
  }

  const model: LpModel = {
    optimize: 'obj',
    opType: 'min',
    constraints: { sum: { equal: 100 } },
    variables: {},
  }

  for (const cand of input.candidates) {
    const k   = san(cand.key)
    const xv  = `x_${k}`
    const dpv = `dp_${k}`
    const dnv = `dn_${k}`
    const dco = `dev_${k}`
    const sp  = startPcts[cand.key]

    // Deviation-from-start-point equality gives Phase 1 a natural feasible basis:
    // at x_i = sp, dp_i = 0, dn_i = 0 the constraint is satisfied trivially.
    model.variables[xv]  = { obj: 0,   sum: 1, [dco]: 1 }
    model.variables[dpv] = { obj: REG, [dco]: -1 }
    model.variables[dnv] = { obj: REG, [dco]:  1 }
    model.constraints[dco] = { equal: sp }

    if (cand.minPct > 0) {
      const lbc = `lb_${k}`
      model.constraints[lbc] = { min: cand.minPct }
      model.variables[xv][lbc] = 1
    }
    if (cand.maxPct < 100) {
      const ubc = `ub_${k}`
      model.constraints[ubc] = { max: cand.maxPct }
      model.variables[xv][ubc] = 1
    }

    for (const n of cand.nutrients) {
      const nc    = san(n.name)
      const coeff = n.amountPer100g / input.yieldPct
      model.variables[xv][`${nc}_pos`] = (model.variables[xv][`${nc}_pos`] ?? 0) + coeff
      model.variables[xv][`${nc}_neg`] = (model.variables[xv][`${nc}_neg`] ?? 0) + coeff
    }
  }

  // L1 nutrient deviation via two inequalities per target:
  //   ep_j absorbs over-target:  achieved - ep_j ≤ T  →  nc_pos: { max: T }
  //   en_j absorbs under-target: achieved + en_j ≥ T  →  nc_neg: { min: T }
  for (const target of scaledTargets) {
    const nc     = san(target.name)
    const nc_pos = `${nc}_pos`
    const nc_neg = `${nc}_neg`
    const epv    = `ep_${nc}`
    const env    = `en_${nc}`
    model.variables[epv] = { obj: 1, [nc_pos]: -1 }
    model.variables[env] = { obj: 1, [nc_neg]:  1 }
    model.constraints[nc_pos] = { max: target.value100g }
    model.constraints[nc_neg] = { min: target.value100g }
  }

  // ── Solve ─────────────────────────────────────────────────────────────────
  let lpResult: Record<string, unknown>
  try {
    lpResult = Solver.Solve(model) as Record<string, unknown>
  } catch (err) {
    console.error('[reverseSolve] Solver threw:', err)
    return buildReverseResult(startPcts, input, scaledTargets, t0)
  }

  if (!lpResult.feasible) {
    // Should not happen with the start-point formulation, but fall back gracefully.
    console.error('[reverseSolve] LP infeasible — returning start-point blend. Result:', lpResult)
    return buildReverseResult(startPcts, input, scaledTargets, t0)
  }

  const suggestedPcts: Record<string, number> = {}
  for (const cand of input.candidates) {
    suggestedPcts[cand.key] = Math.max(0, (lpResult[`x_${san(cand.key)}`] as number) ?? 0)
  }

  return buildReverseResult(suggestedPcts, input, scaledTargets, t0)
}

function buildReverseResult(
  pcts: Record<string, number>,
  input: ReverseInput,
  scaledTargets: Array<NutrientTarget & { value100g: number }>,
  t0: number,
): SolverResult {
  const achieved = new Map<string, number>()
  for (const cand of input.candidates) {
    const pct = pcts[cand.key] ?? 0
    for (const n of cand.nutrients) {
      achieved.set(n.name, (achieved.get(n.name) ?? 0) + n.amountPer100g * pct / input.yieldPct)
    }
  }

  // Compare achieved (per 100g) against targets scaled to per-100g
  const auditTrace: AuditEntry[] = scaledTargets.map(target => {
    const ach   = achieved.get(target.name) ?? null
    const delta = ach != null ? Math.abs(ach - target.value100g) : null
    const rel   = delta != null ? delta / (target.value100g || 1) : null
    const status: AuditEntry['status'] =
      rel == null ? 'no-data' :
      rel < 0.01  ? 'satisfied' :
      rel < 0.05  ? 'binding' : 'violated'
    return {
      label:       target.name,
      requirement: `= ${target.value100g.toFixed(2)} ${target.unit} / 100 g`,
      achieved:    ach,
      unit:        target.unit,
      slack:       delta != null ? -delta : null,
      status,
    }
  })

  return { status: 'optimal', suggestedPcts: pcts, auditTrace, solveTimeMs: Date.now() - t0 }
}

function buildAuditTrace(
  targets: ProjectTarget[],
  achieved: Map<string, number> | null,   // nutrient name → per 100g finished
  _yieldPct: number,
  servingSizeG: number | null,
): AuditEntry[] {
  return targets
    .filter(t => t.nutrient)
    .map(t => {
      const ach_per100g = achieved?.get(t.nutrient!) ?? null
      const bf = (t.basis === 'per_serving' && servingSizeG) ? servingSizeG / 100 : 1
      const ach = ach_per100g != null ? ach_per100g * bf : null

      let slack: number | null = null
      let status: AuditEntry['status'] = ach == null ? 'no-data' : 'satisfied'

      if (ach != null) {
        switch (t.comparator) {
          case '>=':  slack = ach - t.value;  status = slack >= -0.001 ? (slack < 0.05 ? 'binding' : 'satisfied') : 'violated'; break
          case '<=':  slack = t.value - ach;  status = slack >= -0.001 ? (slack < 0.05 ? 'binding' : 'satisfied') : 'violated'; break
          case '=': { const d = Math.abs(ach - t.value); slack = -d; status = d < 0.05 ? 'binding' : (d < t.value * 0.02 ? 'satisfied' : 'violated'); break }
          case 'range':
            if (t.valueMax != null) {
              slack = Math.min(ach - t.value, t.valueMax - ach)
              status = slack >= -0.001 ? (slack < 0.05 ? 'binding' : 'satisfied') : 'violated'
            }
            break
        }
      }

      return { label: t.label || t.nutrient!, requirement: fmtReq(t), achieved: ach, unit: t.unit, slack, status }
    })
}
