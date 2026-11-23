import { describe, expect, it } from 'vitest'
import { planChanges, proposalChangesSchema, type PlanLine, type PlanState, type PlanStep, type ProposalChanges } from './sous-chef-proposals'

const line = (over: Partial<PlanLine> & Pick<PlanLine, 'id' | 'ingredientId' | 'ingredientName' | 'weightG'>): PlanLine => ({
  position: 1, pct: 0, locked: false, pctLocked: false, stagePct: null, addedAfterStepId: null,
  weightUnit: null, amountDecimals: null, pctDecimals: null, minPct: null, maxPct: null, ...over,
})
const step = (over: Partial<PlanStep> & Pick<PlanStep, 'id' | 'stepNo' | 'instruction'>): PlanStep => ({
  params: {}, lossType: null, lossAmount: null, lossUnit: 'g', ...over,
})

const base = (): PlanState => ({
  header: { name: 'Oat Bar', version: 2, status: 'draft', servingSizeG: 40, batchSizeG: 1000, batchLocked: false, notes: null },
  lines: [
    line({ id: 'l-oats', ingredientId: 'oats', ingredientName: 'Oats', weightG: 600, pct: 60, position: 1 }),
    line({ id: 'l-honey', ingredientId: 'honey', ingredientName: 'Honey', weightG: 300, pct: 30, position: 2 }),
    line({ id: 'l-salt', ingredientId: 'salt', ingredientName: 'Salt', weightG: 100, pct: 10, position: 3 }),
  ],
  steps: [
    step({ id: 's1', stepNo: 1, instruction: 'Mix dry ingredients' }),
    step({ id: 's2', stepNo: 2, instruction: 'Bake', params: { temp_c: '175' }, lossType: 'moisture', lossAmount: 8, lossUnit: 'pct' }),
  ],
})

const change = (over: Partial<ProposalChanges>): ProposalChanges => ({
  formulationId: 'f1', createNewIteration: false, summary: 'Less honey', ...over,
})

const names = new Map([['inulin', 'Inulin']])

describe('proposalChangesSchema', () => {
  it('accepts a typical proposal', () => {
    const r = proposalChangesSchema.safeParse(change({ lines: [{ ingredientId: 'honey', grams: 250 }], steps: [{ action: 'update', step: 2, params: { temp_c: '170' } }] }))
    expect(r.success).toBe(true)
  })
})

describe('planChanges: lines', () => {
  it('changes, adds and removes ingredients and recomputes %', () => {
    const r = planChanges(base(), change({
      lines: [{ ingredientId: 'honey', grams: 250 }, { ingredientId: 'inulin', grams: 50 }, { ingredientId: 'salt', remove: true }],
    }), names)
    if (!r.ok) throw new Error(r.error)
    expect(r.plan.lines.map(l => [l.ingredientName, l.weightG, l.pct])).toEqual([
      ['Oats', 600, 66.6667], ['Honey', 250, 27.7778], ['Inulin', 50, 5.5556],
    ])
    expect(r.preview.totals).toEqual({ fromG: 1000, toG: 900 })
    expect(r.preview.lines.map(l => [l.ingredient, l.change])).toEqual([['Salt', 'removed'], ['Honey', 'changed'], ['Inulin', 'added']])
  })

  it('refuses an unknown ingredient, a missing one to remove, and an empty change', () => {
    expect(planChanges(base(), change({ lines: [{ ingredientId: 'nope', grams: 5 }] }), names).ok).toBe(false)
    expect(planChanges(base(), change({ lines: [{ ingredientId: 'inulin', remove: true }] }), names).ok).toBe(false)
    expect(planChanges(base(), change({ lines: [{ ingredientId: 'oats', grams: 600 }] }), names)).toMatchObject({ ok: false })
  })

  it('refuses to guess when an ingredient has two lines', () => {
    const s = base()
    s.lines.push(line({ id: 'l-honey2', ingredientId: 'honey', ingredientName: 'Honey', weightG: 10, position: 4 }))
    const r = planChanges(s, change({ lines: [{ ingredientId: 'honey', grams: 200 }] }), names)
    expect(r).toMatchObject({ ok: false })
  })

  it('keeps a % lock at the share it ends up with, and says so', () => {
    const s = base()
    s.lines[2] = { ...s.lines[2], pctLocked: true }
    const r = planChanges(s, change({ lines: [{ ingredientId: 'honey', grams: 200 }] }), names)
    if (!r.ok) throw new Error(r.error)
    const salt = r.plan.lines.find(l => l.ingredientId === 'salt')!
    expect(salt).toMatchObject({ pctLocked: true, pct: 11.1111 })
    expect(r.preview.warnings.join(' ')).toMatch(/Salt is locked at 10%/)
  })

  it('moves the batch size with the total when the batch is locked', () => {
    const s = base()
    s.header.batchLocked = true
    const r = planChanges(s, change({ lines: [{ ingredientId: 'honey', grams: 200 }] }), names)
    if (!r.ok) throw new Error(r.error)
    expect(r.plan.header.batchSizeG).toBe(900)
    expect(r.preview.details).toContainEqual({ label: 'Batch size', from: '1000 g', to: '900 g' })
  })
})

describe('planChanges: steps', () => {
  it('adds, updates and removes steps by their current numbers', () => {
    const r = planChanges(base(), change({
      steps: [
        { action: 'add', step: 0, instruction: 'Toast oats' },
        { action: 'update', step: 2, params: { temp_c: '165' }, loss: { type: 'moisture', amount: 10, unit: 'pct' } },
        { action: 'remove', step: 1 },
        { action: 'add', instruction: 'Cool and cut' },
      ],
    }), names)
    if (!r.ok) throw new Error(r.error)
    expect(r.plan.steps.map(s => s.instruction)).toEqual(['Toast oats', 'Bake', 'Cool and cut'])
    expect(r.plan.steps[1]).toMatchObject({ sourceId: 's2', params: { temp_c: '165' }, lossAmount: 10 })
    expect(r.plan.removedStepIds).toEqual(['s1'])
    expect(r.preview.steps.find(s => s.change === 'changed')!.notes).toEqual([
      'Temperature (°C): 175 → 165', 'Moisture loss 8% → Moisture loss 10%',
    ])
  })

  it('sends lines staged after a removed step back to the starting blend', () => {
    const s = base()
    s.lines[2] = { ...s.lines[2], addedAfterStepId: 's1', pctLocked: true, stagePct: 5 }
    const r = planChanges(s, change({ steps: [{ action: 'remove', step: 1 }] }), names)
    if (!r.ok) throw new Error(r.error)
    expect(r.plan.lines[2]).toMatchObject({ addedAfterStepId: null, stagePct: null, pctLocked: false })
    expect(r.preview.warnings[0]).toMatch(/starting blend/)
  })

  it('refuses bad step numbers, double edits and bad measurements', () => {
    expect(planChanges(base(), change({ steps: [{ action: 'remove', step: 3 }] }), names).ok).toBe(false)
    expect(planChanges(base(), change({ steps: [{ action: 'update', step: 1, instruction: 'a' }, { action: 'remove', step: 1 }] }), names).ok).toBe(false)
    expect(planChanges(base(), change({ steps: [{ action: 'add' }] }), names).ok).toBe(false)
    expect(planChanges(base(), change({ steps: [{ action: 'update', step: 1, params: { ph: '20' } }] }), names).ok).toBe(false)
    expect(planChanges(base(), change({ steps: [{ action: 'update', step: 1, params: { 'Temp C': '80' } }] }), names).ok).toBe(false)
  })
})

describe('planChanges: locked iterations and details', () => {
  it('only allows a new iteration of a locked one', () => {
    const s = base()
    s.header.status = 'locked'
    const edit = { lines: [{ ingredientId: 'honey', grams: 200 }] }
    expect(planChanges(s, change(edit), names)).toMatchObject({ ok: false })
    expect(planChanges(s, change({ ...edit, createNewIteration: true, iterationNote: 'Less honey' }), names)).toMatchObject({
      ok: true, preview: { newIteration: true, iterationNote: 'Less honey' },
    })
  })

  it('changes the serving size and notes', () => {
    const r = planChanges(base(), change({ details: { servingSizeG: 45, notes: 'Bake on parchment' } }), names)
    if (!r.ok) throw new Error(r.error)
    expect(r.plan.header).toEqual({ servingSizeG: 45, notes: 'Bake on parchment' })
  })
})
