import { z } from 'zod'
import { lossFieldsError } from '@/lib/process-loss-fields'
import { describeStepLoss } from '@/lib/process-loss'
import { paramPatchError } from '@/lib/step-measurements'

// Changes Sous Chef proposes to a formulation, which the person approves or declines in the chat.
// Pure pieces (no DB access): the tool's input schema, and `planChanges`, which works out the
// formulation as it would be after the change plus the before/after preview the approval card
// shows. lib/sous-chef-proposals-server.ts stores proposals and applies approved ones.

const r4 = (n: number) => Math.round(n * 1e4) / 1e4

// Keys are checked in applyStepEdits (a key pattern in the schema becomes `propertyNames`, which tool APIs may not take)
const stepParams = z.record(z.string(), z.string().max(2000).nullable())
const PARAM_KEY = /^[a-z_]{1,40}$/

export const proposalChangesSchema = z.object({
  formulationId: z.string().describe('The iteration to change, or to base the new iteration on (an id from get_formulation)'),
  createNewIteration: z.boolean().describe('true: copy the iteration as the next version and change the copy, leaving the original as it is. false: change this iteration itself'),
  summary: z.string().min(1).max(600).describe('What the change does and why, in a sentence or two; shown on the approval card'),
  iterationNote: z.string().max(2000).optional().describe('For a new iteration: what changed from the one it is based on, e.g. "Swapped 2% inulin for 1.5% chicory root fiber"'),
  details: z.object({
    name: z.string().min(1).max(255).optional().describe('Renames the formulation (every iteration)'),
    servingSizeG: z.number().positive().nullable().optional(),
    batchSizeG: z.number().positive().nullable().optional(),
    notes: z.string().max(5000).nullable().optional().describe('Replaces the formulation notes'),
  }).optional(),
  lines: z.array(z.object({
    ingredientId: z.string().describe('A library ingredient id (search_ingredients)'),
    grams: z.number().min(0).optional().describe('The line’s new amount in grams; adds the ingredient if it isn’t in the formulation yet'),
    remove: z.boolean().optional().describe('true to take the ingredient out'),
  })).max(200).optional().describe('Ingredient changes in grams. Ingredients not mentioned keep their amounts. The batch total is the sum of the lines'),
  steps: z.array(z.object({
    action: z.enum(['add', 'update', 'remove']),
    step: z.number().int().min(0).optional().describe('update/remove: the step number as it is now. add: insert after this step number (0 = before the first step); leave out to add at the end'),
    instruction: z.string().min(1).max(2000).optional().describe('add: required. update: the new instruction'),
    params: stepParams.optional().describe('Measurements to set on the step: temp_c, time (hh:mm:ss), ph, speed, start_time and end_time (HH:mm), notes; null clears one'),
    loss: z.object({
      type: z.enum(['production', 'moisture']).nullable().describe('null clears the loss'),
      amount: z.number().positive().optional(),
      unit: z.enum(['g', 'pct']).optional(),
    }).optional().describe('Weight lost at this step: production loss, or moisture lost (e.g. in baking). type null clears both losses'),
    thenLoss: z.object({
      type: z.enum(['production', 'moisture']).nullable().describe('null clears the second loss'),
      amount: z.number().positive().optional(),
      unit: z.enum(['g', 'pct']).optional(),
    }).optional().describe('A second loss at the same step, applied after the first (a % is of the weight left after it), e.g. 60% moisture off in a centrifuge, then 7% production loss left in it'),
  })).max(50).optional().describe('Process step changes, numbered as the steps are now'),
})

export type ProposalChanges = z.infer<typeof proposalChangesSchema>

// ── The formulation as it is ──────────────────────────────────────────────────

export type PlanLine = {
  id: string
  ingredientId: string
  ingredientName: string
  position: number
  weightG: number
  pct: number
  locked: boolean
  pctLocked: boolean
  stagePct: number | null
  addedAfterStepId: string | null
  weightUnit: string | null
  amountDecimals: number | null
  pctDecimals: number | null
  minPct: number | null
  maxPct: number | null
}

export type PlanStep = {
  id: string
  stepNo: number
  instruction: string
  params: Record<string, string>
  lossType: 'production' | 'moisture' | null
  lossAmount: number | null
  lossUnit: 'g' | 'pct'
  /** A second loss, applied after the first */
  loss2Type: 'production' | 'moisture' | null
  loss2Amount: number | null
  loss2Unit: 'g' | 'pct'
}

export type PlanHeader = {
  name: string
  version: number
  status: string
  servingSizeG: number | null
  batchSizeG: number | null
  batchLocked: boolean
  notes: string | null
}

export type PlanState = { header: PlanHeader; lines: PlanLine[]; steps: PlanStep[] }

// ── The formulation as it would be ────────────────────────────────────────────

export type FinalLine = Omit<PlanLine, 'id' | 'pct' | 'position'> & {
  /** The line it came from; null for an added ingredient */
  sourceId: string | null
  /** Stored % of the batch: the exact locked value for a %-locked line, else its share */
  pct: number
}

export type FinalStep = Omit<PlanStep, 'id' | 'stepNo'> & {
  /** The step it came from; null for an added step */
  sourceId: string | null
}

export type Plan = {
  header: Partial<Pick<PlanHeader, 'name' | 'servingSizeG' | 'batchSizeG' | 'notes'>>
  lines: FinalLine[]
  steps: FinalStep[]
  /** Source step ids that are removed */
  removedStepIds: string[]
}

// ── What the approval card shows ──────────────────────────────────────────────

export type ProposalPreview = {
  formulationName: string
  version: number
  newIteration: boolean
  summary: string
  iterationNote: string | null
  details: { label: string; from: string | null; to: string | null }[]
  lines: { ingredient: string; change: 'added' | 'removed' | 'changed'; fromG: number | null; toG: number | null; fromPct: number | null; toPct: number | null }[]
  totals: { fromG: number; toG: number }
  steps: { change: 'added' | 'removed' | 'changed'; from: { no: number; text: string } | null; to: { no: number; text: string } | null; notes: string[] }[]
  warnings: string[]
}

export type ProposalStatus = 'pending' | 'applied' | 'declined' | 'stale' | 'reverted'

/** How the person chose to save an approved change */
export type SaveAs = 'new_iteration' | 'this_iteration'

/** A proposal as the chat shows it */
export type ProposalView = {
  id: string
  status: ProposalStatus
  formulationId: string
  resultFormulationId: string | null
  resultVersion: number | null
  /** Pending: whether it may be saved over the iteration (not when that iteration is locked) */
  canSaveOver: boolean
  /** Applied over the iteration, with the earlier version kept: it can be put back */
  canRevert: boolean
  preview: ProposalPreview
}

export type PlanResult = { ok: true; plan: Plan; preview: ProposalPreview } | { ok: false; error: string }

const PARAM_LABELS: Record<string, string> = {
  temp_c: 'Temperature (°C)', time: 'Time', ph: 'pH', speed: 'Speed', start_time: 'Start', end_time: 'End', notes: 'Notes',
  solids_pct: 'Solids %', shear: 'Shear', pressure: 'Pressure', time_min: 'Time (min)',
}
const lossText = (s: Pick<PlanStep, 'lossType' | 'lossAmount' | 'lossUnit' | 'loss2Type' | 'loss2Amount' | 'loss2Unit'>) =>
  describeStepLoss(s) ?? 'no loss'
const g = (n: number | null) => (n == null ? null : `${r4(n)} g`)

/**
 * The formulation after `changes`, or why the change can't be made. `ingredientNames` names every
 * ingredient the change adds (the caller checks they are in the account's library).
 */
export function planChanges(state: PlanState, changes: ProposalChanges, ingredientNames: Map<string, string>): PlanResult {
  const fail = (error: string): PlanResult => ({ ok: false, error })
  const { header } = state
  if (header.status === 'locked' && !changes.createNewIteration) {
    return fail('This iteration is locked. Propose the change as a new iteration (createNewIteration: true).')
  }
  const warnings: string[] = []

  // ── Steps ──
  const steps = [...state.steps].sort((a, b) => a.stepNo - b.stepNo)
  const n = steps.length
  const touched = new Set<number>()
  const updated = new Map<number, FinalStep>()
  const removed = new Set<number>()
  const addsAfter = new Map<number, FinalStep[]>()
  const stepNotes = new Map<number, string[]>()
  for (const op of changes.steps ?? []) {
    if (op.action === 'add') {
      if (!op.instruction?.trim()) return fail('A step to add needs an instruction.')
      const after = op.step ?? n
      if (after > n) return fail(`There is no step ${after} to add a step after; the formulation has ${n} step${n === 1 ? '' : 's'}.`)
      const fresh: FinalStep = { sourceId: null, instruction: op.instruction.trim(), params: {}, lossType: null, lossAmount: null, lossUnit: 'g', loss2Type: null, loss2Amount: null, loss2Unit: 'g' }
      const err = applyStepEdits(fresh, op)
      if (err) return fail(err)
      addsAfter.set(after, [...(addsAfter.get(after) ?? []), fresh])
      continue
    }
    if (op.step == null || op.step < 1 || op.step > n) return fail(`There is no step ${op.step ?? '(missing)'}; the formulation has ${n} step${n === 1 ? '' : 's'}.`)
    if (touched.has(op.step)) return fail(`Step ${op.step} is changed more than once; combine the changes into one.`)
    touched.add(op.step)
    const src = steps[op.step - 1]
    if (op.action === 'remove') { removed.add(op.step); continue }
    const next: FinalStep = { sourceId: src.id, instruction: src.instruction, params: { ...src.params }, lossType: src.lossType, lossAmount: src.lossAmount, lossUnit: src.lossUnit, loss2Type: src.loss2Type, loss2Amount: src.loss2Amount, loss2Unit: src.loss2Unit }
    if (op.instruction?.trim()) next.instruction = op.instruction.trim()
    const err = applyStepEdits(next, op)
    if (err) return fail(err)
    const notes: string[] = []
    for (const key of new Set([...Object.keys(src.params), ...Object.keys(next.params)])) {
      if ((src.params[key] ?? '') !== (next.params[key] ?? '')) {
        notes.push(`${PARAM_LABELS[key] ?? key}: ${src.params[key] || '–'} → ${next.params[key] || '–'}`)
      }
    }
    if (lossText(src) !== lossText(next)) notes.push(`${lossText(src)} → ${lossText(next)}`)
    if (next.instruction === src.instruction && notes.length === 0) continue // nothing actually changes
    updated.set(op.step, next)
    stepNotes.set(op.step, notes)
  }

  const finalSteps: FinalStep[] = []
  const previewSteps: ProposalPreview['steps'] = []
  const pushAdds = (k: number) => {
    for (const s of addsAfter.get(k) ?? []) {
      finalSteps.push(s)
      const notes = [...Object.entries(s.params).map(([key, v]) => `${PARAM_LABELS[key] ?? key}: ${v}`), ...(s.lossType || s.loss2Type ? [lossText(s)] : [])]
      previewSteps.push({ change: 'added', from: null, to: { no: finalSteps.length, text: s.instruction }, notes })
    }
  }
  pushAdds(0)
  steps.forEach((s, i) => {
    const no = i + 1
    if (removed.has(no)) {
      previewSteps.push({ change: 'removed', from: { no, text: s.instruction }, to: null, notes: [] })
    } else {
      const u = updated.get(no)
      finalSteps.push(u ?? { sourceId: s.id, instruction: s.instruction, params: s.params, lossType: s.lossType, lossAmount: s.lossAmount, lossUnit: s.lossUnit, loss2Type: s.loss2Type, loss2Amount: s.loss2Amount, loss2Unit: s.loss2Unit })
      if (u) previewSteps.push({ change: 'changed', from: { no, text: s.instruction }, to: { no: finalSteps.length, text: u.instruction }, notes: stepNotes.get(no) ?? [] })
    }
    pushAdds(no)
  })
  const removedStepIds = steps.filter((_, i) => removed.has(i + 1)).map(s => s.id)

  // ── Lines ──
  const byIngredient = new Map<string, PlanLine[]>()
  for (const l of state.lines) byIngredient.set(l.ingredientId, [...(byIngredient.get(l.ingredientId) ?? []), l])
  const lineOps = new Map<string, { grams?: number; remove?: boolean }>()
  for (const op of changes.lines ?? []) {
    if (lineOps.has(op.ingredientId)) return fail('An ingredient is listed more than once in the line changes; give each one once.')
    if (!op.remove && op.grams == null) return fail('Each line change needs grams, or remove: true.')
    const existing = byIngredient.get(op.ingredientId) ?? []
    if (existing.length > 1) return fail(`${existing[0].ingredientName} appears more than once in this formulation, so Sous Chef can’t tell which line to change. Ask the user to change it by hand.`)
    if (existing.length === 0 && op.remove) return fail('An ingredient to remove isn’t in this formulation.')
    if (existing.length === 0 && !ingredientNames.has(op.ingredientId)) return fail('An ingredient to add wasn’t found in the library; use an id from search_ingredients.')
    lineOps.set(op.ingredientId, { grams: op.grams == null ? undefined : r4(op.grams), remove: op.remove })
  }

  type Draft = FinalLine & { fromG: number | null; fromPct: number | null }
  const drafts: Draft[] = []
  for (const l of [...state.lines].sort((a, b) => a.position - b.position)) {
    const op = lineOps.get(l.ingredientId)
    if (op?.remove) continue
    const grams = op?.grams ?? l.weightG
    const stepGone = !!l.addedAfterStepId && removedStepIds.includes(l.addedAfterStepId)
    const draft: Draft = {
      sourceId: l.id, ingredientId: l.ingredientId, ingredientName: l.ingredientName, weightG: grams, pct: 0,
      locked: l.locked, pctLocked: l.pctLocked, stagePct: l.stagePct, addedAfterStepId: stepGone ? null : l.addedAfterStepId,
      weightUnit: l.weightUnit, amountDecimals: l.amountDecimals, pctDecimals: l.pctDecimals,
      minPct: l.minPct, maxPct: l.maxPct, fromG: l.weightG, fromPct: l.pct,
    }
    if (stepGone) {
      warnings.push(`${l.ingredientName} was added after a step that is removed, so it moves to the starting blend.`)
      draft.stagePct = null
      if (draft.pctLocked) draft.pctLocked = false
    } else if (l.addedAfterStepId && grams !== l.weightG && l.pctLocked) {
      // Its locked % is of the mass leaving its step, which can't be recomputed here
      warnings.push(`${l.ingredientName} is added after a step with a locked %; its amount changes, so the lock is removed.`)
      draft.pctLocked = false
      draft.stagePct = null
    }
    drafts.push(draft)
  }
  for (const [ingredientId, op] of lineOps) {
    if (op.remove || byIngredient.has(ingredientId)) continue
    drafts.push({
      sourceId: null, ingredientId, ingredientName: ingredientNames.get(ingredientId)!, weightG: op.grams!, pct: 0,
      locked: false, pctLocked: false, stagePct: null, addedAfterStepId: null, weightUnit: null,
      amountDecimals: null, pctDecimals: null, minPct: null, maxPct: null,
      fromG: null, fromPct: null,
    })
  }

  const fromTotal = state.lines.reduce((s, l) => s + l.weightG, 0)
  const toTotal = r4(drafts.reduce((s, l) => s + l.weightG, 0))
  for (const d of drafts) {
    const share = toTotal > 0 ? (d.weightG / toTotal) * 100 : 0
    d.pct = r4(share)
    // A %-locked line holds the % it ends up at, so the stored lock matches its grams
    if (d.pctLocked && !d.addedAfterStepId && d.fromPct != null && Math.abs(d.fromPct - d.pct) >= 0.01) {
      warnings.push(`${d.ingredientName} is locked at ${r4(d.fromPct)}% of the batch; with this change it becomes ${d.pct}%.`)
    }
  }

  const previewLines: ProposalPreview['lines'] = []
  for (const l of state.lines) {
    if (lineOps.get(l.ingredientId)?.remove) {
      previewLines.push({ ingredient: l.ingredientName, change: 'removed', fromG: l.weightG, toG: null, fromPct: r4(l.pct), toPct: null })
    }
  }
  for (const d of drafts) {
    if (d.sourceId == null) previewLines.push({ ingredient: d.ingredientName, change: 'added', fromG: null, toG: d.weightG, fromPct: null, toPct: d.pct })
    else if (d.fromG !== d.weightG) previewLines.push({ ingredient: d.ingredientName, change: 'changed', fromG: d.fromG, toG: d.weightG, fromPct: r4(d.fromPct!), toPct: d.pct })
  }

  // ── Details ──
  const planHeader: Plan['header'] = {}
  const details: ProposalPreview['details'] = []
  const d = changes.details ?? {}
  if (d.name !== undefined && d.name.trim() !== header.name) {
    planHeader.name = d.name.trim()
    details.push({ label: 'Name (every iteration)', from: header.name, to: planHeader.name })
  }
  if (d.servingSizeG !== undefined && d.servingSizeG !== header.servingSizeG) {
    planHeader.servingSizeG = d.servingSizeG
    details.push({ label: 'Serving size', from: g(header.servingSizeG), to: g(d.servingSizeG) })
  }
  let batch = d.batchSizeG !== undefined ? d.batchSizeG : header.batchSizeG
  if (header.batchLocked && batch != null && Math.abs(batch - toTotal) > 1e-4 && toTotal > 0) {
    warnings.push(`The batch size is locked, so it changes to the new total of ${toTotal} g.`)
    batch = toTotal
  }
  if (batch !== header.batchSizeG) {
    planHeader.batchSizeG = batch
    details.push({ label: 'Batch size', from: g(header.batchSizeG), to: g(batch) })
  }
  if (d.notes !== undefined && (d.notes?.trim() || null) !== (header.notes || null)) {
    planHeader.notes = d.notes?.trim() || null
    details.push({ label: 'Notes', from: header.notes || null, to: planHeader.notes })
  }

  if (previewLines.length === 0 && previewSteps.length === 0 && details.length === 0) {
    return fail('The change doesn’t alter anything: every amount, step and detail is already as proposed.')
  }

  return {
    ok: true,
    plan: {
      header: planHeader,
      lines: drafts.map(({ fromG: _f, fromPct: _p, ...l }) => l),
      steps: finalSteps,
      removedStepIds,
    },
    preview: {
      formulationName: header.name,
      version: header.version,
      newIteration: changes.createNewIteration,
      summary: changes.summary.trim(),
      iterationNote: changes.createNewIteration ? changes.iterationNote?.trim() || null : null,
      details,
      lines: previewLines,
      totals: { fromG: r4(fromTotal), toG: toTotal },
      steps: previewSteps,
      warnings,
    },
  }
}

// Instruction excluded: applies the measurements and loss of an add/update op to `s`
function applyStepEdits(s: FinalStep, op: NonNullable<ProposalChanges['steps']>[number]): string | null {
  if (op.params) {
    const badKey = Object.keys(op.params).find(k => !PARAM_KEY.test(k))
    if (badKey) return `“${badKey}” isn’t a step measurement; use temp_c, time, ph, speed, start_time, end_time or notes.`
    const err = paramPatchError(op.params)
    if (err) return err
    for (const [key, value] of Object.entries(op.params)) {
      if (value == null || value === '') delete s.params[key]
      else s.params[key] = value
    }
  }
  if (op.loss || op.thenLoss) {
    // Clearing the first loss clears both, unless a second one is given in the same op
    const keepSecond = op.loss?.type !== null
    const loss = {
      lossType: op.loss ? op.loss.type : s.lossType,
      lossAmount: op.loss ? op.loss.amount ?? null : s.lossAmount,
      lossUnit: op.loss ? op.loss.unit ?? 'g' as const : s.lossUnit,
      loss2Type: op.thenLoss ? op.thenLoss.type : keepSecond ? s.loss2Type : null,
      loss2Amount: op.thenLoss ? op.thenLoss.amount ?? null : keepSecond ? s.loss2Amount : null,
      loss2Unit: op.thenLoss ? op.thenLoss.unit ?? 'g' as const : keepSecond ? s.loss2Unit : 'g' as const,
    }
    const err = lossFieldsError(loss)
    if (err) return err
    // A second loss with no first one moves up to be the first
    const [first, second] = [
      { type: loss.lossType, amount: loss.lossAmount, unit: loss.lossUnit },
      { type: loss.loss2Type, amount: loss.loss2Amount, unit: loss.loss2Unit },
    ].filter(l => l.type)
    s.lossType = first?.type ?? null
    s.lossAmount = first ? first.amount : null
    s.lossUnit = first?.unit ?? 'g'
    s.loss2Type = second?.type ?? null
    s.loss2Amount = second ? second.amount : null
    s.loss2Unit = second?.unit ?? 'g'
  }
  return null
}
