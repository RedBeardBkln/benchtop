import { describe, expect, it } from 'vitest'
import { flowForLines, resolveWithStages, type StagedLockLine, type StageStep } from './staged-additions'
import { resolveLines } from './formula-lock'
import { calcNutrientProfile, calcNutrientContributions, type CalcNutrient } from './formulation-calc'

// Yogurt: blend, pasteurize, ferment, homogenize, then centrifuge off 60% of the weight as whey
const steps: StageStep[] = [
  { id: 'blend', lossType: null, lossAmount: null, lossUnit: 'g' },
  { id: 'pasteurize', lossType: null, lossAmount: null, lossUnit: 'g' },
  { id: 'ferment', lossType: null, lossAmount: null, lossUnit: 'g' },
  { id: 'homogenize', lossType: null, lossAmount: null, lossUnit: 'g' },
  { id: 'centrifuge', lossType: 'moisture', lossAmount: 60, lossUnit: 'pct' },
]

const line = (key: string, weightG: number, extra: Partial<StagedLockLine> = {}): StagedLockLine => ({
  key, weightG, locked: false, pctLocked: false, lockedPct: null, addedAfterStepId: null, ...extra,
})

const milk = line('milk', 1575)
const sugar = line('sugar', 25)
// 0.10% of the white mass leaving the centrifuge, not of the milk weighed in
const flavor = line('flavor', 0, { addedAfterStepId: 'centrifuge', pctLocked: true, lockedPct: 0.1 })

describe('resolveWithStages', () => {
  it('takes a staged usage % of the mass leaving its step', () => {
    const res = resolveWithStages({ lines: [milk, sugar, flavor], steps, batchLocked: false, batchG: null })
    expect(res.problem).toBeNull()
    expect(res.weights.milk).toBe(1575)
    expect(res.weights.sugar).toBe(25)
    // 1600 g × 40% left after the centrifuge = 640 g; 0.10% of that
    expect(res.weights.flavor).toBeCloseTo(0.64, 4)
  })

  it('follows the step loss when it changes', () => {
    const lessWhey = steps.map(s => (s.id === 'centrifuge' ? { ...s, lossAmount: 50 } : s))
    const res = resolveWithStages({ lines: [milk, sugar, flavor], steps: lessWhey, batchLocked: false, batchG: null })
    expect(res.weights.flavor).toBeCloseTo(0.8, 4)
  })

  it('keeps a locked batch size, staged ingredients included', () => {
    const res = resolveWithStages({ lines: [milk, sugar, flavor], steps, batchLocked: true, batchG: 1000 })
    expect(res.problem).toBeNull()
    const total = res.weights.milk + res.weights.sugar + res.weights.flavor
    expect(total).toBeCloseTo(1000, 4)
    const start = res.weights.milk + res.weights.sugar
    expect(res.weights.flavor).toBeCloseTo(start * 0.4 * 0.001, 4)
    // The starting blend keeps its proportions
    expect(res.weights.milk / res.weights.sugar).toBeCloseTo(1575 / 25, 3)
  })

  it('counts staged grams in the batch a %-locked starting line is a share of', () => {
    const lockedSugar = line('sugar', 25, { pctLocked: true, lockedPct: 2 })
    const res = resolveWithStages({ lines: [milk, lockedSugar, flavor], steps, batchLocked: false, batchG: null })
    const total = res.weights.milk + res.weights.sugar + res.weights.flavor
    expect(res.weights.sugar / total * 100).toBeCloseTo(2, 3)
    expect(res.weights.flavor).toBeCloseTo((res.weights.milk + res.weights.sugar) * 0.4 * 0.001, 4)
  })

  it('keeps the grams of a staged line without a locked %', () => {
    const fruit = line('fruit', 50, { addedAfterStepId: 'centrifuge' })
    const res = resolveWithStages({ lines: [milk, sugar, fruit], steps, batchLocked: false, batchG: null })
    expect(res.weights.fruit).toBe(50)
  })

  it('sets grams from a % typed on a staged line', () => {
    const fruit = line('fruit', 50, { addedAfterStepId: 'centrifuge' })
    const res = resolveWithStages({
      lines: [milk, sugar, fruit], steps, batchLocked: false, batchG: null,
      anchor: { key: 'fruit', kind: 'pct', value: 10 },
    })
    expect(res.weights.fruit).toBeCloseTo(64, 4)
  })

  it('treats a line whose step is gone as part of the starting blend', () => {
    const orphan = line('flavor', 3, { addedAfterStepId: 'deleted-step' })
    const res = resolveWithStages({ lines: [milk, sugar, orphan], steps, batchLocked: false, batchG: null })
    expect(res.weights.flavor).toBe(3)
  })

  it('is exactly resolveLines with nothing staged', () => {
    const lines = [milk, line('sugar', 25, { pctLocked: true, lockedPct: 5 })]
    expect(resolveWithStages({ lines, steps, batchLocked: true, batchG: 500 }))
      .toEqual(resolveLines({ lines, batchLocked: true, batchG: 500 }))
  })

  it('reports locks it cannot honor', () => {
    const fixed = line('fruit', 2000, { addedAfterStepId: 'centrifuge', locked: true })
    const res = resolveWithStages({ lines: [milk, sugar, fixed], steps, batchLocked: true, batchG: 1000 })
    expect(res.problem).not.toBeNull()
  })
})

describe('flowForLines', () => {
  it('applies only the later steps’ losses to a staged line', () => {
    const flow = flowForLines([
      { weightG: 1600 },
      { weightG: 100, addedAfterStepId: 'ferment' },
    ], steps)
    // (1600 + 100) × 40% — the centrifuge comes after the addition
    expect(flow.finishedWeightG).toBeCloseTo(680, 6)
    expect(flow.massAfterStepG[2]).toBe(1600)
    expect(flow.inputWeightG).toBe(1700)
  })

  it('leaves a line added after the last step untouched by every loss', () => {
    const flow = flowForLines([
      { weightG: 1600 },
      { weightG: 0.64, addedAfterStepId: 'centrifuge' },
    ], steps)
    expect(flow.finishedWeightG).toBeCloseTo(640.64, 6)
    expect(flow.yieldPct).toBeCloseTo((640.64 / 1600.64) * 100, 6)
  })
})

describe('calcNutrientProfile with staged lines', () => {
  const PROTEIN = 'protein'
  const nutrients: CalcNutrient[] = [{ id: PROTEIN, name: 'Protein', unit: 'g', category: 'macros' }]
  const lossSteps: StageStep[] = [
    { id: 'dry', lossType: 'moisture', lossAmount: 50, lossUnit: 'pct' },
    { id: 'pan', lossType: 'production', lossAmount: 10, lossUnit: 'pct' },
  ]

  it('takes a later production loss from a staged line too', () => {
    // 100 g at 10 g protein/100 g dries to 50 g; 50 g of a protein-free ingredient goes in; 10% is left in the pan
    const lines = [
      { ingredientId: 'base', weightG: 100, nutrients: [{ nutrientId: PROTEIN, amountPer100g: 10 }] },
      { ingredientId: 'filler', weightG: 50, addedAfterStepId: 'dry', nutrients: [] },
    ]
    const calc = calcNutrientProfile({ lines, allNutrients: nutrients, steps: lossSteps })
    expect(calc.finishedWeightG).toBeCloseTo(90, 6)
    // 10 g protein × 90% kept, in 90 g
    expect(calc.results[0].perFinished100g).toBeCloseTo(10, 6)
  })

  it('spares a staged line the losses before it', () => {
    // The staged ingredient carries the protein and skips the 50% moisture loss
    const lines = [
      { ingredientId: 'base', weightG: 100, nutrients: [] },
      { ingredientId: 'whey', weightG: 50, addedAfterStepId: 'dry', nutrients: [{ nutrientId: PROTEIN, amountPer100g: 80 }] },
    ]
    const calc = calcNutrientProfile({ lines, allNutrients: nutrients, steps: lossSteps })
    // 40 g protein × 90% in 90 g finished
    expect(calc.results[0].perFinished100g).toBeCloseTo(40, 6)
    const parts = calcNutrientContributions(lines, PROTEIN, calc.concentrationWeightG, calc.stageFactors)
    expect(parts[0].perFinished100g).toBeCloseTo(40, 6)
  })

  it('matches the unstaged result when nothing is staged', () => {
    const lines = [
      { ingredientId: 'base', weightG: 100, nutrients: [{ nutrientId: PROTEIN, amountPer100g: 10 }] },
      { ingredientId: 'filler', weightG: 50, nutrients: [] },
    ]
    const calc = calcNutrientProfile({ lines, allNutrients: nutrients, steps: lossSteps })
    // 150 → 75 → 67.5 g; 10 g protein × 90%
    expect(calc.finishedWeightG).toBeCloseTo(67.5, 6)
    expect(calc.results[0].perFinished100g).toBeCloseTo((9 / 67.5) * 100, 6)
  })
})
