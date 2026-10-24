import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { formulationImports, formulationLines, formulations, processSteps } from '@/lib/db/schema'
import { importDraftSchema, linesToSave, missingInfo } from '@/lib/formulation-import'
import { assertIngredientsOwned, loadProjectForEdit, notFoundResponse } from '@/lib/tenancy'

const bodySchema = z.object({
  draft: importDraftSchema,
  // The saved draft this came from, removed once the formulation exists
  importId: z.string().uuid().nullable().optional(),
})

// Creates the formulation from a complete import: v1 in the chosen project, with its lines and
// process steps. Refused while anything vital is missing (save it as a draft instead).
export async function POST(req: NextRequest) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid import' }, { status: 400 })
  const { draft, importId } = parsed.data

  const { vital } = missingInfo(draft)
  if (vital.length) {
    return NextResponse.json({ error: `Still missing: ${vital.join('; ')}`, code: 'incomplete', missing: vital }, { status: 422 })
  }
  const lines = linesToSave(draft)!
  const loaded = await loadProjectForEdit(ctx, draft.project.id!)
  if (!loaded.ok) return loaded.res
  if (!(await assertIngredientsOwned(ctx, lines.map(l => l.ingredientId)))) {
    return notFoundResponse('One or more ingredients were not found')
  }

  const total = lines.reduce((s, l) => s + l.weightG, 0)
  const steps = draft.steps.filter(s => s.included && s.instruction.trim())
  const id = crypto.randomUUID()

  await db.transaction(async tx => {
    await tx.insert(formulations).values({
      id,
      accountId: ctx.account.id,
      familyId: id,
      projectId: draft.project.id!,
      name: draft.name.trim(),
      servingSizeG: draft.servingSizeG?.toString() ?? null,
      notes: draft.notes?.trim() || null,
      iterationNote: `Imported from ${draft.fileName}`.slice(0, 500),
    })
    await tx.insert(formulationLines).values(lines.map((l, i) => ({
      formulationId: id,
      ingredientId: l.ingredientId,
      position: i + 1,
      weightG: l.weightG.toString(),
      pct: total > 0 ? ((l.weightG / total) * 100).toString() : '0',
    })))
    if (steps.length) {
      await tx.insert(processSteps).values(steps.map((s, i) => ({
        formulationId: id,
        stepNo: i + 1,
        instruction: s.instruction.trim(),
      })))
    }
    if (importId) {
      await tx.delete(formulationImports).where(and(
        eq(formulationImports.id, importId),
        eq(formulationImports.accountId, ctx.account.id),
        eq(formulationImports.userId, ctx.user.id),
      ))
    }
  })

  return NextResponse.json({ formulationId: id }, { status: 201 })
}
