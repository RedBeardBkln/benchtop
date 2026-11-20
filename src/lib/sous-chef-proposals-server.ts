import { createHash } from 'node:crypto'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { equipment, formulationLines, formulations, ingredients, processSteps, sousChefProposals } from '@/lib/db/schema'
import { loadFormulationForEdit, type TenantScope } from '@/lib/tenancy'
import { duplicateFormulation } from '@/lib/duplicate-formulation'
import {
  planChanges, type Plan, type PlanState, type ProposalChanges, type ProposalPreview, type ProposalStatus,
  type ProposalView, type SaveAs,
} from '@/lib/sous-chef-proposals'

// Sous Chef's proposed formulation changes: stored by the propose_formulation_change tool, shown in
// the chat as an approval card, and applied only when the person approves (POST
// /api/sous-chef/proposals/[id]), as a new iteration or over the iteration itself. A change saved
// over the iteration keeps a snapshot of what it replaced, so the person can revert it.
// See lib/sous-chef-proposals.ts for the planning.

type Scope = TenantScope & { user: { id: string } }
type Formulation = typeof formulations.$inferSelect
type ProposalRow = typeof sousChefProposals.$inferSelect
/** db, or a transaction (reads inside one see its own writes) */
type Reader = Pick<typeof db, 'select'>

/** The iteration as it was before a change was saved over it */
type RevertSnapshot = {
  header: { name: string; servingSizeG: string | null; batchSizeG: string | null; notes: string | null }
  steps: (typeof processSteps.$inferSelect)[]
  lines: (typeof formulationLines.$inferSelect)[]
}

const num = (v: string | null) => (v == null ? null : Number(v))

async function loadState(f: Formulation, q: Reader = db): Promise<PlanState> {
  const [lines, steps] = await Promise.all([
    q.select({ line: formulationLines, ingredientName: ingredients.name })
      .from(formulationLines)
      .innerJoin(ingredients, eq(formulationLines.ingredientId, ingredients.id))
      .where(eq(formulationLines.formulationId, f.id))
      .orderBy(asc(formulationLines.position)),
    q.select().from(processSteps).where(eq(processSteps.formulationId, f.id)).orderBy(asc(processSteps.stepNo)),
  ])
  return {
    header: {
      name: f.name, version: f.version, status: f.status, servingSizeG: num(f.servingSizeG),
      batchSizeG: num(f.batchSizeG), batchLocked: f.batchLocked, notes: f.notes,
    },
    lines: lines.map(({ line: l, ingredientName }) => ({
      id: l.id, ingredientId: l.ingredientId, ingredientName, position: l.position, weightG: Number(l.weightG),
      pct: Number(l.pct), locked: l.locked, pctLocked: l.pctLocked, stagePct: num(l.stagePct),
      addedAfterStepId: l.addedAfterStepId, weightUnit: l.weightUnit, minPct: num(l.minPct), maxPct: num(l.maxPct),
    })),
    steps: steps.map(s => ({
      id: s.id, stepNo: s.stepNo, instruction: s.instruction, params: (s.params ?? {}) as Record<string, string>,
      lossType: s.lossType as PlanState['steps'][number]['lossType'], lossAmount: num(s.lossAmount), lossUnit: (s.lossUnit as 'g' | 'pct') ?? 'g',
    })),
  }
}

/** Changes when anything a proposal is based on changes (saving the grid or editing a step) */
function fingerprint(s: PlanState): string {
  return createHash('sha256').update(JSON.stringify(s)).digest('hex')
}

async function ingredientNames(scope: TenantScope, changes: ProposalChanges) {
  const ids = [...new Set((changes.lines ?? []).filter(l => !l.remove).map(l => l.ingredientId))]
    .filter(id => /^[0-9a-f-]{36}$/i.test(id))
  if (ids.length === 0) return new Map<string, string>()
  const rows = await db.select({ id: ingredients.id, name: ingredients.name }).from(ingredients)
    .where(and(eq(ingredients.accountId, scope.account.id), inArray(ingredients.id, ids)))
  return new Map(rows.map(r => [r.id, r.name]))
}

/** The iteration, if the person can edit it, else why not (in words for Sous Chef or the person) */
async function editable(scope: TenantScope, formulationId: string): Promise<{ ok: true; f: Formulation } | { ok: false; error: string }> {
  // The same check the formulation editing routes make
  const loaded = await loadFormulationForEdit(scope, formulationId)
  if (!loaded.ok) {
    return {
      ok: false,
      error: loaded.res.status === 403
        ? 'This person can view this formulation but not edit it, so the change can’t be made.'
        : 'No formulation with that id',
    }
  }
  if (loaded.formulation.archivedAt) return { ok: false, error: 'This formulation is archived. Restore it before changing it.' }
  return { ok: true, f: loaded.formulation }
}

/** Stores a proposal for the person to approve; nothing changes in the formulation */
export async function createProposal(scope: Scope, conversationId: string, changes: ProposalChanges) {
  const target = await editable(scope, changes.formulationId)
  if (!target.ok) return { ok: false as const, error: target.error }
  const state = await loadState(target.f)
  const planned = planChanges(state, changes, await ingredientNames(scope, changes))
  if (!planned.ok) return planned
  const [row] = await db.insert(sousChefProposals).values({
    accountId: scope.account.id, userId: scope.user.id, conversationId, formulationId: target.f.id,
    changes, preview: planned.preview, baseFingerprint: fingerprint(state),
  }).returning()
  return { ok: true as const, view: toView(row, { resultVersion: null, sourceLocked: target.f.status === 'locked' }) }
}

function toView(row: ProposalRow, extra: { resultVersion: number | null; sourceLocked: boolean }): ProposalView {
  return {
    id: row.id, status: row.status as ProposalStatus, formulationId: row.formulationId,
    resultFormulationId: row.resultFormulationId, resultVersion: extra.resultVersion,
    canSaveOver: row.status === 'pending' && !extra.sourceLocked,
    canRevert: row.status === 'applied' && row.snapshot != null,
    preview: row.preview as ProposalPreview,
  }
}

/** A conversation's proposals for the chat, keyed by the assistant message that made them */
export async function loadProposalViews(conversationId: string, ids?: string[]) {
  const rows = await db
    .select({
      p: sousChefProposals,
      resultVersion: formulations.version,
      sourceStatus: sql<string | null>`(select f.status from formulations f where f.id = ${sousChefProposals.formulationId})`,
    })
    .from(sousChefProposals)
    .leftJoin(formulations, eq(sousChefProposals.resultFormulationId, formulations.id))
    .where(and(eq(sousChefProposals.conversationId, conversationId), ids ? inArray(sousChefProposals.id, ids) : undefined))
    .orderBy(asc(sousChefProposals.createdAt))
  return rows.map(r => ({
    messageId: r.p.messageId,
    view: toView(r.p, { resultVersion: r.resultVersion, sourceLocked: r.sourceStatus === 'locked' }),
  }))
}

async function viewOf(row: ProposalRow): Promise<ProposalView> {
  const [found] = await loadProposalViews(row.conversationId, [row.id])
  return found.view
}

/** For the system prompt: what became of the proposals made in this conversation */
export async function describeProposalsForPrompt(conversationId: string): Promise<string | null> {
  const rows = await loadProposalViews(conversationId)
  if (rows.length === 0) return null
  const status = (v: ProposalView) => ({
    pending: 'waiting for the user to approve or decline',
    applied: v.preview.newIteration
      ? `approved and saved as a new iteration v${v.resultVersion} (id ${v.resultFormulationId})`
      : `approved and saved over that iteration (id ${v.resultFormulationId ?? v.formulationId}); the user can revert it`,
    declined: 'declined by the user',
    stale: 'not applied: the formulation changed after it was proposed',
    reverted: 'saved over that iteration, then reverted by the user, so the iteration is back as it was before',
  }[v.status])
  return rows.slice(-20).map(({ view: v }) =>
    `- [${v.id}] ${v.preview.formulationName} v${v.preview.version}: ${v.preview.summary} → ${status(v)}`).join('\n')
}

export async function attachProposalsToMessage(ids: string[], messageId: string) {
  if (ids.length === 0) return
  await db.update(sousChefProposals).set({ messageId }).where(inArray(sousChefProposals.id, ids))
}

export type DecideResult =
  | { ok: true; view: ProposalView }
  | { ok: false; status: number; error: string; code?: string; view?: ProposalView }

export type Decision =
  | { decision: 'approve'; saveAs?: SaveAs }
  | { decision: 'decline' }
  | { decision: 'revert'; force?: boolean }

async function loadOwn(scope: Scope, id: string) {
  const [row] = await db.select().from(sousChefProposals)
    .where(and(eq(sousChefProposals.id, id), eq(sousChefProposals.accountId, scope.account.id), eq(sousChefProposals.userId, scope.user.id)))
    .limit(1)
  return row ?? null
}

/** Approves (saves), declines or reverts one of the person's proposals */
export async function decideProposal(scope: Scope, id: string, d: Decision): Promise<DecideResult> {
  const row = await loadOwn(scope, id)
  if (!row) return { ok: false, status: 404, error: 'Not found' }
  if (d.decision === 'revert') return revertProposal(scope, row, !!d.force)
  if (row.status !== 'pending') return { ok: false, status: 409, error: 'This change was already decided.', view: await viewOf(row) }

  const settle = async (status: ProposalStatus) => {
    const [updated] = await db.update(sousChefProposals)
      .set({ status, decidedAt: new Date() })
      .where(and(eq(sousChefProposals.id, id), eq(sousChefProposals.status, 'pending')))
      .returning()
    return updated
  }

  if (d.decision === 'decline') {
    const updated = await settle('declined')
    return updated ? { ok: true, view: await viewOf(updated) } : { ok: false, status: 409, error: 'This change was already decided.' }
  }

  const target = await editable(scope, row.formulationId)
  if (!target.ok) return { ok: false, status: 403, error: target.error }
  const state = await loadState(target.f)
  if (fingerprint(state) !== row.baseFingerprint) {
    const updated = await settle('stale')
    return {
      ok: false, status: 409,
      error: 'The formulation changed after Sous Chef proposed this, so it wasn’t applied. Ask Sous Chef to propose it again.',
      view: updated ? await viewOf(updated) : undefined,
    }
  }
  // The person's choice of where to save wins over what Sous Chef suggested
  const proposed = row.changes as ProposalChanges
  const changes: ProposalChanges = { ...proposed, createNewIteration: d.saveAs ? d.saveAs === 'new_iteration' : proposed.createNewIteration }
  const planned = planChanges(state, changes, await ingredientNames(scope, changes))
  if (!planned.ok) return { ok: false, status: 409, error: planned.error }

  try {
    const result = await applyPlan(row.id, target.f, planned.plan, changes, planned.preview)
    if (!result) return { ok: false, status: 409, error: 'This change was already decided.' }
    return { ok: true, view: await viewOf(result) }
  } catch (err) {
    console.error('[sous-chef] applying proposal failed:', err)
    return { ok: false, status: 500, error: 'The change couldn’t be saved. Nothing was changed; try again.' }
  }
}

/**
 * Claims the proposal and writes the planned formulation, all in one transaction: into a new
 * iteration, or over this one (keeping a snapshot of it first). Null when another request claimed
 * the proposal first.
 */
async function applyPlan(proposalId: string, source: Formulation, plan: Plan, changes: ProposalChanges, preview: ProposalPreview) {
  return db.transaction(async tx => {
    // Only one approval can win; a second click finds it no longer pending
    const [claimed] = await tx.update(sousChefProposals)
      .set({ status: 'applied', decidedAt: new Date() })
      .where(and(eq(sousChefProposals.id, proposalId), eq(sousChefProposals.status, 'pending')))
      .returning({ id: sousChefProposals.id })
    if (!claimed) return null

    let targetId = source.id
    let snapshot: RevertSnapshot | null = null
    // Source step id → the target's step id (the same for this iteration; the copy's for a new one)
    const stepIdMap = new Map<string, string>()
    if (changes.createNewIteration) {
      const created = await duplicateFormulation(source, { kind: 'iteration' }, tx)
      targetId = created.id
      const [srcSteps, newSteps] = await Promise.all([
        tx.select({ id: processSteps.id, stepNo: processSteps.stepNo }).from(processSteps).where(eq(processSteps.formulationId, source.id)),
        tx.select({ id: processSteps.id, stepNo: processSteps.stepNo }).from(processSteps).where(eq(processSteps.formulationId, created.id)),
      ])
      const byNo = new Map(newSteps.map(s => [s.stepNo, s.id]))
      for (const s of srcSteps) stepIdMap.set(s.id, byNo.get(s.stepNo)!)
    } else {
      const [steps, lines] = await Promise.all([
        tx.select().from(processSteps).where(eq(processSteps.formulationId, source.id)),
        tx.select().from(formulationLines).where(eq(formulationLines.formulationId, source.id)),
      ])
      for (const s of steps) stepIdMap.set(s.id, s.id)
      snapshot = {
        header: { name: source.name, servingSizeG: source.servingSizeG, batchSizeG: source.batchSizeG, notes: source.notes },
        steps, lines,
      }
    }

    // Lines go first (they point at steps), then steps, then the lines are written back
    await tx.delete(formulationLines).where(eq(formulationLines.formulationId, targetId))

    const removed = plan.removedStepIds.map(id => stepIdMap.get(id)!).filter(Boolean)
    if (removed.length > 0) await tx.delete(processSteps).where(and(eq(processSteps.formulationId, targetId), inArray(processSteps.id, removed)))
    // Park the kept steps' numbers out of the way, then number every step in its new order
    await tx.update(processSteps).set({ stepNo: sql`-${processSteps.stepNo}` }).where(eq(processSteps.formulationId, targetId))
    for (const [i, s] of plan.steps.entries()) {
      const values = {
        stepNo: i + 1, instruction: s.instruction, params: s.params,
        lossType: s.lossType, lossAmount: s.lossAmount?.toString() ?? null, lossUnit: s.lossUnit,
      }
      if (s.sourceId) {
        await tx.update(processSteps).set(values).where(and(eq(processSteps.id, stepIdMap.get(s.sourceId)!), eq(processSteps.formulationId, targetId)))
      } else {
        await tx.insert(processSteps).values({ formulationId: targetId, ...values })
      }
    }

    if (plan.lines.length > 0) {
      await tx.insert(formulationLines).values(plan.lines.map((l, i) => {
        const stepId = l.addedAfterStepId ? stepIdMap.get(l.addedAfterStepId) ?? null : null
        return {
          formulationId: targetId, ingredientId: l.ingredientId, position: i + 1,
          weightG: l.weightG.toString(), pct: l.pct.toString(), locked: l.locked, pctLocked: l.pctLocked,
          weightUnit: l.weightUnit, addedAfterStepId: stepId,
          stagePct: stepId && l.pctLocked && l.stagePct != null ? l.stagePct.toString() : null,
          minPct: l.minPct?.toString() ?? null, maxPct: l.maxPct?.toString() ?? null,
        }
      }))
    }

    const h = plan.header
    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (h.servingSizeG !== undefined) updates.servingSizeG = h.servingSizeG?.toString() ?? null
    if (h.batchSizeG !== undefined) updates.batchSizeG = h.batchSizeG?.toString() ?? null
    if (h.notes !== undefined) updates.notes = h.notes
    if (changes.createNewIteration) updates.iterationNote = changes.iterationNote?.trim() || changes.summary.trim().slice(0, 2000)
    await tx.update(formulations).set(updates).where(and(eq(formulations.id, targetId), eq(formulations.accountId, source.accountId)))
    // The name belongs to the formulation as a whole
    if (h.name !== undefined) {
      await tx.update(formulations).set({ name: h.name })
        .where(and(eq(formulations.familyId, source.familyId), eq(formulations.accountId, source.accountId)))
    }

    // Saved over the iteration: remember how it looks now, to tell later whether it was edited since
    let appliedFingerprint: string | null = null
    if (snapshot) {
      const [after] = await tx.select().from(formulations).where(eq(formulations.id, targetId))
      appliedFingerprint = fingerprint(await loadState(after, tx))
    }
    const [proposal] = await tx.update(sousChefProposals)
      .set({ resultFormulationId: targetId, changes, preview, snapshot, appliedFingerprint })
      .where(eq(sousChefProposals.id, proposalId)).returning()
    return proposal
  })
}

class RevertRefused extends Error {}

/** Puts an iteration back as it was before a change was saved over it */
async function revertProposal(scope: Scope, row: ProposalRow, force: boolean): Promise<DecideResult> {
  const snap = row.snapshot as RevertSnapshot | null
  if (row.status !== 'applied' || !snap || row.resultFormulationId !== row.formulationId) {
    return { ok: false, status: 409, error: 'This change can’t be reverted.', view: await viewOf(row) }
  }
  const target = await editable(scope, row.formulationId)
  if (!target.ok) return { ok: false, status: 403, error: target.error }
  const f = target.f
  if (f.status === 'locked') {
    return { ok: false, status: 409, error: 'This iteration has been locked since, so it can’t be reverted. Unlock it first.' }
  }
  if (!force && fingerprint(await loadState(f)) !== row.appliedFingerprint) {
    return {
      ok: false, status: 409, code: 'edited_since',
      error: `v${f.version} was edited after this change was saved. Reverting puts it back as it was before the change, which also undoes those later edits.`,
    }
  }

  try {
    const reverted = await db.transaction(async tx => {
      const [claimed] = await tx.update(sousChefProposals)
        .set({ status: 'reverted', revertedAt: new Date() })
        .where(and(eq(sousChefProposals.id, row.id), eq(sousChefProposals.status, 'applied')))
        .returning()
      if (!claimed) return null

      // An ingredient taken out by the change may have been deleted from the library since
      const ingredientIds = [...new Set(snap.lines.map(l => l.ingredientId))]
      if (ingredientIds.length > 0) {
        const found = await tx.select({ id: ingredients.id }).from(ingredients)
          .where(and(eq(ingredients.accountId, scope.account.id), inArray(ingredients.id, ingredientIds)))
        if (found.length < ingredientIds.length) {
          throw new RevertRefused('An ingredient the earlier version used has since been deleted from the library, so it can’t be put back.')
        }
      }
      const equipmentIds = [...new Set(snap.steps.flatMap(s => (s.equipmentId ? [s.equipmentId] : [])))]
      const liveEquipment = equipmentIds.length > 0
        ? new Set((await tx.select({ id: equipment.id }).from(equipment)
            .where(and(eq(equipment.accountId, scope.account.id), inArray(equipment.id, equipmentIds)))).map(e => e.id))
        : new Set<string>()

      await tx.delete(formulationLines).where(eq(formulationLines.formulationId, f.id))
      await tx.delete(processSteps).where(eq(processSteps.formulationId, f.id))
      if (snap.steps.length > 0) {
        await tx.insert(processSteps).values(snap.steps.map(s => ({
          ...s, formulationId: f.id, equipmentId: s.equipmentId && liveEquipment.has(s.equipmentId) ? s.equipmentId : null,
        })))
      }
      if (snap.lines.length > 0) {
        await tx.insert(formulationLines).values(snap.lines.map(l => ({ ...l, formulationId: f.id })))
      }
      await tx.update(formulations)
        .set({ servingSizeG: snap.header.servingSizeG, batchSizeG: snap.header.batchSizeG, notes: snap.header.notes, updatedAt: new Date() })
        .where(and(eq(formulations.id, f.id), eq(formulations.accountId, scope.account.id)))
      if (snap.header.name !== f.name) {
        await tx.update(formulations).set({ name: snap.header.name })
          .where(and(eq(formulations.familyId, f.familyId), eq(formulations.accountId, scope.account.id)))
      }
      return claimed
    })
    if (!reverted) return { ok: false, status: 409, error: 'This change was already reverted.', view: await viewOf(row) }
    return { ok: true, view: await viewOf(reverted) }
  } catch (err) {
    if (err instanceof RevertRefused) return { ok: false, status: 409, error: err.message }
    console.error('[sous-chef] reverting proposal failed:', err)
    return { ok: false, status: 500, error: 'The revert couldn’t be saved. Nothing was changed; try again.' }
  }
}
