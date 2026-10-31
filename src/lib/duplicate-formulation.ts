import { db } from '@/lib/db'
import { formulations, formulationLines, processSteps } from '@/lib/db/schema'
import { and, eq, max } from 'drizzle-orm'
import type { Formulation } from '@/lib/types'

type Target =
  // Next sequential version inside the source's family
  | { kind: 'iteration' }
  // Brand-new family starting at v1 under a new name
  | { kind: 'formulation'; name: string }

/**
 * Copies a formulation (header, lines, process steps) as a draft.
 * Runs in a transaction so a failed copy never leaves a half-populated row.
 */
export async function duplicateFormulation(source: Formulation, target: Target) {
  return db.transaction(async tx => {
    const newId = crypto.randomUUID()
    let familyId = newId
    let version = 1
    let name = source.name
    let parentFormulationId: string | null = null

    if (target.kind === 'iteration') {
      const [{ maxVer }] = await tx
        .select({ maxVer: max(formulations.version) })
        .from(formulations)
        .where(and(eq(formulations.familyId, source.familyId), eq(formulations.accountId, source.accountId)))
      familyId = source.familyId
      version = (maxVer ?? 0) + 1
      parentFormulationId = source.id
    } else {
      name = target.name
    }

    const [created] = await tx
      .insert(formulations)
      .values({
        id: newId,
        // Copies stay in the source's account (the caller has already proven ownership of source)
        accountId: source.accountId,
        familyId,
        projectId: source.projectId,
        name,
        version,
        parentFormulationId,
        mode: source.mode,
        status: 'draft',
        servingSizeG: source.servingSizeG,
        batchSizeG: source.batchSizeG,
        batchLocked: source.batchLocked,
        notes: source.notes,
        gridNutrientIds: source.gridNutrientIds,
        weightUnit: source.weightUnit,
      })
      .returning()

    // Steps first: lines added after a step point at the copy's step
    const sourceSteps = await tx
      .select()
      .from(processSteps)
      .where(eq(processSteps.formulationId, source.id))

    const newStepId = new Map(sourceSteps.map(s => [s.id, crypto.randomUUID()]))
    if (sourceSteps.length > 0) {
      await tx.insert(processSteps).values(
        sourceSteps.map(s => ({
          id: newStepId.get(s.id)!,
          formulationId: created.id,
          stepNo: s.stepNo,
          instruction: s.instruction,
          params: s.params,
          lossType: s.lossType,
          lossAmount: s.lossAmount,
          lossUnit: s.lossUnit,
          equipmentId: s.equipmentId,
        }))
      )
    }

    const sourceLines = await tx
      .select()
      .from(formulationLines)
      .where(eq(formulationLines.formulationId, source.id))

    if (sourceLines.length > 0) {
      await tx.insert(formulationLines).values(
        sourceLines.map(l => ({
          formulationId: created.id,
          ingredientId: l.ingredientId,
          position: l.position,
          weightG: l.weightG,
          pct: l.pct,
          minPct: l.minPct,
          maxPct: l.maxPct,
          locked: l.locked,
          pctLocked: l.pctLocked,
          weightUnit: l.weightUnit,
          addedAfterStepId: l.addedAfterStepId ? newStepId.get(l.addedAfterStepId) ?? null : null,
          stagePct: l.addedAfterStepId && newStepId.has(l.addedAfterStepId) ? l.stagePct : null,
        }))
      )
    }

    return created
  })
}
