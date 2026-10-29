import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { formulationNfpPanels } from '@/lib/db/schema'
import { isUuid, notFoundResponse, loadFormulationForEdit } from '@/lib/tenancy'
import { createSchema, panelColumns } from '@/lib/nfp-panel-api'

type Ctx = { params: Promise<{ id: string; panelId: string }> }

// Edit a saved panel in place: its name, and the label rebuilt from the dialog's settings
export async function PUT(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res

  const { id, panelId } = await params
  const loaded = await loadFormulationForEdit(auth.ctx, id)
  if (!loaded.ok) return loaded.res
  if (!isUuid(panelId)) return notFoundResponse()

  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    const msg = Object.values(parsed.error.flatten().fieldErrors).flat().find(Boolean) ?? 'Invalid panel'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  const { name, servingSizeG, options, model } = parsed.data

  // Scoped to the owned formulation, so a panel id from another iteration/account is a miss
  const [panel] = await db
    .update(formulationNfpPanels)
    .set({
      name,
      rulesVersion: model.rulesVersion,
      servingSizeG: servingSizeG != null ? String(servingSizeG) : null,
      options,
      model,
    })
    .where(and(eq(formulationNfpPanels.id, panelId), eq(formulationNfpPanels.formulationId, id)))
    .returning(panelColumns)

  if (!panel) return notFoundResponse()
  return NextResponse.json({ panel })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res

  const { id, panelId } = await params
  const loaded = await loadFormulationForEdit(auth.ctx, id)
  if (!loaded.ok) return loaded.res
  if (!isUuid(panelId)) return notFoundResponse()

  // Scoped to the owned formulation, so a panel id from another iteration/account is a miss
  const deleted = await db
    .delete(formulationNfpPanels)
    .where(and(eq(formulationNfpPanels.id, panelId), eq(formulationNfpPanels.formulationId, id)))
    .returning({ id: formulationNfpPanels.id })

  if (deleted.length === 0) return notFoundResponse()
  return NextResponse.json({ ok: true })
}
