// Ingredients added part-way through the process — pure, no side effects.
//
// A line can be added after a process step (formulation_lines.added_after_step_id) instead of in the
// starting blend. It skips the losses of that step and the ones before it, and only the later steps' losses
// apply to it. A staged line either keeps its grams, or with its usage % locked it is always that % of
// the batch weight leaving the step (e.g. a flavor at 0.10% of the yogurt left after centrifuging, not of
// the milk weighed in).
//
// The starting blend is balanced by resolveLines as before, with all the staged grams standing in as one
// quantity-locked line: a locked batch size and %-locked lines both count the whole input, staged lines
// included. Staged grams depend on the starting blend and the starting blend on the staged grams, so the
// two are solved together (secant method; the relation is linear unless a step loses a fixed number of grams).

import { resolveLines, type Anchor, type LockLine, type ResolveResult } from '@/lib/formula-lock'
import { simulateProcess, type LossStep, type ProcessFlow } from '@/lib/process-loss'

export type StagedLockLine = LockLine & {
  /** The step this line is added after; null (or a step no longer in the list) = the starting blend */
  addedAfterStepId: string | null
}

export type StageStep = LossStep & { id: string }

const r4 = (n: number) => Math.round(n * 1e4) / 1e4
const STAGED_KEY = '\u0000staged'

/** Index of the step a line is added after, or -1 for the starting blend. */
export function stageIndex(addedAfterStepId: string | null | undefined, steps: Array<{ id?: string }>): number {
  if (!addedAfterStepId) return -1
  return steps.findIndex(s => s.id === addedAfterStepId)
}

/** Run a formula's lines through the steps, each staged line going in after its step. */
export function flowForLines(
  lines: Array<{ weightG: number; addedAfterStepId?: string | null }>,
  steps: LossStep[],
): ProcessFlow {
  const addedAfter = new Array<number>(steps.length).fill(0)
  let startG = 0
  for (const l of lines) {
    const i = stageIndex(l.addedAfterStepId, steps)
    if (i >= 0) addedAfter[i] += l.weightG
    else startG += l.weightG
  }
  return simulateProcess(startG, steps, i => addedAfter[i])
}

export type StageFlow = {
  /** Grams of each staged line, by key */
  weights: Record<string, number>
  /** Batch weight leaving each step, before anything is added after it */
  massAfterStepG: number[]
}

/**
 * Grams of each staged line once a starting blend of `startG` has been through the steps.
 * A %-locked staged line is `lockedPct` % of the weight leaving its step; any other keeps its grams.
 * `anchor` is a value just typed on a staged line: a % sets its grams from the mass at that point.
 */
export function stageFlow(
  startG: number,
  steps: LossStep[],
  staged: Array<StagedLockLine>,
  anchor?: Anchor,
): StageFlow {
  const weights: Record<string, number> = {}
  const flow = simulateProcess(startG, steps, (i, massG) => {
    let added = 0
    for (const l of staged) {
      if (stageIndex(l.addedAfterStepId, steps) !== i) continue
      let g = l.weightG
      if (anchor?.key === l.key) {
        g = anchor.kind === 'qty' ? anchor.value : (anchor.value / 100) * massG
      } else if (l.pctLocked && l.lockedPct != null) {
        g = (l.lockedPct / 100) * massG
      }
      weights[l.key] = r4(Math.max(0, g))
      added += weights[l.key]
    }
    return added
  })
  return { weights, massAfterStepG: flow.massAfterStepG }
}

/**
 * resolveLines, for a formula with ingredients added after process steps. Without any, it is exactly
 * resolveLines.
 */
export function resolveWithStages(input: {
  lines: StagedLockLine[]
  steps: LossStep[]
  batchLocked: boolean
  batchG: number | null
  anchor?: Anchor
}): ResolveResult {
  const { lines, steps, batchLocked, batchG, anchor } = input
  const isStaged = (l: StagedLockLine) => stageIndex(l.addedAfterStepId, steps) >= 0
  const staged = lines.filter(isStaged)
  if (staged.length === 0) return resolveLines({ lines, batchLocked, batchG, anchor })

  const start = lines.filter(l => !isStaged(l))
  const startAnchor = anchor && start.some(l => l.key === anchor.key) ? anchor : undefined
  const stagedAnchor = anchor && !startAnchor ? anchor : undefined

  // Balance the starting blend around `s` g of staged ingredients, then see how many grams they come to
  const evaluate = (s: number) => {
    const res = resolveLines({
      lines: [...start, { key: STAGED_KEY, weightG: s, locked: true, pctLocked: false, lockedPct: null }],
      batchLocked, batchG, anchor: startAnchor,
    })
    const startG = start.reduce((sum, l) => sum + (res.weights[l.key] ?? 0), 0)
    const flow = stageFlow(startG, steps, staged, stagedAnchor)
    const total = Object.values(flow.weights).reduce((sum, w) => sum + w, 0)
    return { res, flow, total }
  }

  let s0 = staged.reduce((sum, l) => sum + l.weightG, 0)
  let e0 = evaluate(s0)
  if (e0.res.problem) return { weights: Object.fromEntries(lines.map(l => [l.key, l.weightG])), problem: e0.res.problem, clamped: false }
  let f0 = e0.total - s0
  let s1 = e0.total
  let e1 = evaluate(s1)
  let f1 = e1.total - s1
  for (let i = 0; i < 50 && Math.abs(f1) > 1e-7; i++) {
    if (e1.res.problem || f1 === f0) break
    const next = s1 - (f1 * (s1 - s0)) / (f1 - f0)
    s0 = s1; e0 = e1; f0 = f1
    s1 = Math.max(0, next)
    e1 = evaluate(s1)
    f1 = e1.total - s1
  }
  // Grams are kept to 0.0001, so the staged total can only match to within that rounding
  const tolerance = 1e-4 * (staged.length + 1)
  if (e1.res.problem || Math.abs(f1) > tolerance) {
    return {
      weights: Object.fromEntries(lines.map(l => [l.key, l.weightG])),
      problem: e1.res.problem
        ?? 'The ingredients added after a process step can’t be balanced with the other locked values.',
      clamped: false,
    }
  }

  const weights: Record<string, number> = {}
  for (const l of start) weights[l.key] = e1.res.weights[l.key] ?? l.weightG
  for (const l of staged) weights[l.key] = e1.flow.weights[l.key] ?? l.weightG

  // A locked batch adds up to exactly its size: the rounding is given to the largest free starting line
  if (batchLocked && batchG != null && batchG > 0) {
    const diff = r4(batchG - lines.reduce((sum, l) => sum + weights[l.key], 0))
    const free = start.filter(l => !l.locked && !l.pctLocked && l.key !== startAnchor?.key)
    if (diff !== 0 && free.length > 0) {
      const biggest = free.reduce((a, b) => (weights[b.key] > weights[a.key] ? b : a))
      weights[biggest.key] = r4(weights[biggest.key] + diff)
    }
  }
  return { weights, problem: null, clamped: e1.res.clamped }
}
