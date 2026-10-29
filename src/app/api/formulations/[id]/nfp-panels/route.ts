import { NextRequest, NextResponse } from 'next/server'
import { count, desc, eq } from 'drizzle-orm'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { formulationNfpPanels } from '@/lib/db/schema'
import { getOwnedFormulation, notFoundResponse, loadFormulationForEdit } from '@/lib/tenancy'
import { createSchema, panelColumns } from '@/lib/nfp-panel-api'

type Ctx = { params: Promise<{ id: string }> }

// Panels are saved against one iteration (formulations row). Cap per iteration so a runaway client
// can't grow a row set without bound.
const MAX_PANELS_PER_FORMULATION = 50

export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res

  const { id } = await params
  if (!(await getOwnedFormulation(auth.ctx, id))) return notFoundResponse()

  const panels = await db
    .select(panelColumns)
    .from(formulationNfpPanels)
    .where(eq(formulationNfpPanels.formulationId, id))
    .orderBy(desc(formulationNfpPanels.createdAt))

  return NextResponse.json({ panels })
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  const loaded = await loadFormulationForEdit(ctx, id)
  if (!loaded.ok) return loaded.res

  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    const msg = Object.values(parsed.error.flatten().fieldErrors).flat().find(Boolean) ?? 'Invalid panel'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  const { name, servingSizeG, options, model } = parsed.data

  const [{ n }] = await db
    .select({ n: count() })
    .from(formulationNfpPanels)
    .where(eq(formulationNfpPanels.formulationId, id))
  if (n >= MAX_PANELS_PER_FORMULATION) {
    return NextResponse.json(
      { error: `This iteration already has ${MAX_PANELS_PER_FORMULATION} saved panels. Delete one first.` },
      { status: 422 },
    )
  }

  const [panel] = await db
    .insert(formulationNfpPanels)
    .values({
      formulationId: id,
      name,
      rulesVersion: model.rulesVersion,
      servingSizeG: servingSizeG != null ? String(servingSizeG) : null,
      options,
      model,
      createdBy: ctx.user.id,
    })
    .returning(panelColumns)

  return NextResponse.json({ panel }, { status: 201 })
}
