import { createHash } from 'node:crypto'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { formulationLines, formulations, ingredients, processSteps, sousChefProposals } from '@/lib/db/schema'
import { loadFormulationForEdit, type TenantScope } from '@/lib/tenancy'
import { duplicateFormulation } from '@/lib/duplicate-formulation'
import {
  planChanges, type Plan, type PlanState, type ProposalChanges, type ProposalPreview, type ProposalStatus, type ProposalView,
} from '@/lib/sous-chef-proposals'

// Sous Chef's proposed formulation changes: stored by the propose_formulation_change tool, shown in
// the chat as an approval card, and applied only when the person approves (POST
// /api/sous-chef/proposals/[id]). See lib/sous-chef-proposals.ts for the planning.

type Scope = TenantScope & { user: { id: string } }
type Formulation = typeof formulations.$inferSelect

const num = (v: string | null) => (v == null ? null : Number(v))

async function loadState(f: Formulation): Promise<PlanState> {
  const [lines, steps] = await Promise.all([
    db.select({ line: formulationLines, ingredientName: ingredients.name })
      .from(formulationLines)
      .innerJoin(ingredients, eq(formulationLines.ingredientId, ingredients.id))
      .where(eq(formulationLines.formulationId, f.id))
      .orderBy(asc(formulationLines.position)),
    db.select().from(processSteps).where(eq(processSteps.formulationId, f.id)).orderBy(asc(processSteps.stepNo)),
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
  return { ok: true as const, view: toView(row, null) }
}

function toView(row: typeof sousChefProposals.$inferSelect, resultVersion: number | null): ProposalView {
  return {
    id: row.id, status: row.status as ProposalStatus, formulationId: row.formulationId,
    resultFormulationId: row.resultFormulationId, resultVersion, preview: row.preview as ProposalPreview,
  }
}

/** A conversation's proposals for the chat, keyed by the assistant message that made them */
export async function loadProposalViews(conversationId: string) {
  const rows = await db
    .select({ p: sousChefProposals, resultVersion: formulations.version })
    .from(sousChefProposals)
    .leftJoin(formulations, eq(sousChefProposals.resultFormulationId, formulations.id))
    .where(eq(sousChefProposals.conversationId, conversationId))
    .orderBy(asc(sousChefProposals.createdAt))
  return rows.map(r => ({ messageId: r.p.messageId, view: toView(r.p, r.resultVersion) }))
}

/** For the system prompt: what became of the proposals made in this conversation */
export async function describeProposalsForPrompt(conversationId: string): Promise<string | null> {
  const rows = await loadProposalViews(conversationId)
  if (rows.length === 0) return null
  const status = (v: ProposalView) => ({
    pending: 'waiting for the user to approve or decline',
    applied: v.resultFormulationId && v.preview.newIteration
      ? `approved and applied as a new iteration v${v.resultVersion} (id ${v.resultFormulationId})`
      : `approved and applied to that iteration (id ${v.resultFormulationId ?? v.formulationId})`,
    declined: 'declined by the user',
    stale: 'not applied: the formulation changed after it was proposed',
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
  | { ok: false; status: number; error: string; view?: ProposalView }

/** Approves (applies) or declines one of the person's pending proposals */
export async function decideProposal(scope: Scope, id: string, decision: 'approve' | 'decline'): Promise<DecideResult> {
  const [row] = await db.select().from(sousChefProposals)
    .where(and(eq(sousChefProposals.id, id), eq(sousChefProposals.accountId, scope.account.id), eq(sousChefProposals.userId, scope.user.id)))
    .limit(1)
  if (!row) return { ok: false, status: 404, error: 'Not found' }
  if (row.status !== 'pending') return { ok: false, status: 409, error: 'This change was already decided.', view: toView(row, null) }

  const settle = async (status: ProposalStatus, resultFormulationId: string | null = null) => {
    const [updated] = await db.update(sousChefProposals)
      .set({ status, resultFormulationId, decidedAt: new Date() })
      .where(and(eq(sousChefProposals.id, id), eq(sousChefProposals.status, 'pending')))
      .returning()
    return updated
  }

  if (decision === 'decline') {
    const updated = await settle('declined')
    return updated ? { ok: true, view: toView(updated, null) } : { ok: false, status: 409, error: 'This change was already decided.' }
  }

  const target = await editable(scope, row.formulationId)
  if (!target.ok) return { ok: false, status: 403, error: target.error }
  const changes = row.changes as ProposalChanges
  const state = await loadState(target.f)
  if (fingerprint(state) !== row.baseFingerprint) {
    const updated = await settle('stale')
    return {
      ok: false, status: 409,
      error: 'The formulation changed after Sous Chef proposed this, so it wasn’t applied. Ask Sous Chef to propose it again.',
      view: updated ? toView(updated, null) : undefined,
    }
  }
  const planned = planChanges(state, changes, await ingredientNames(scope, changes))
  if (!planned.ok) return { ok: false, status: 409, error: planned.error }

  try {
    const result = await applyPlan(row.id, target.f, planned.plan, changes)
    if (!result) return { ok: false, status: 409, error: 'This change was already decided.' }
    return { ok: true, view: toView(result.proposal, result.version) }
  } catch (err) {
    console.error('[sous-chef] applying proposal failed:', err)
    return { ok: false, status: 500, error: 'The change couldn’t be saved. Nothing was changed; try again.' }
  }
}

/**
 * Claims the proposal and writes the planned formulation, all in one transaction: into a new
 * iteration, or over this one. Null when another request claimed the proposal first.
 */
async function applyPlan(proposalId: string, source: Formulation, plan: Plan, changes: ProposalChanges) {
  return db.transaction(async tx => {
    // Only one approval can win; a second click finds it no longer pending
    const [claimed] = await tx.update(sousChefProposals)
      .set({ status: 'applied', decidedAt: new Date() })
      .where(and(eq(sousChefProposals.id, proposalId), eq(sousChefProposals.status, 'pending')))
      .returning({ id: sousChefProposals.id })
    if (!claimed) return null

    let targetId = source.id
    let version = source.version
    // Source step id → the target's step id (the same for this iteration; the copy's for a new one)
    const stepIdMap = new Map<string, string>()
    if (changes.createNewIteration) {
      const created = await duplicateFormulation(source, { kind: 'iteration' }, tx)
      targetId = created.id
      version = created.version
      const [srcSteps, newSteps] = await Promise.all([
        tx.select({ id: processSteps.id, stepNo: processSteps.stepNo }).from(processSteps).where(eq(processSteps.formulationId, source.id)),
        tx.select({ id: processSteps.id, stepNo: processSteps.stepNo }).from(processSteps).where(eq(processSteps.formulationId, created.id)),
      ])
      const byNo = new Map(newSteps.map(s => [s.stepNo, s.id]))
      for (const s of srcSteps) stepIdMap.set(s.id, byNo.get(s.stepNo)!)
    } else {
      const own = await tx.select({ id: processSteps.id }).from(processSteps).where(eq(processSteps.formulationId, source.id))
      for (const s of own) stepIdMap.set(s.id, s.id)
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
    const [proposal] = await tx.update(sousChefProposals).set({ resultFormulationId: targetId })
      .where(eq(sousChefProposals.id, proposalId)).returning()
    return { proposal, version }
  })
}
