import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { projects, formulations } from '@/lib/db/schema'
import { and, desc, eq, sql } from 'drizzle-orm'
import { getOwnedProject, loadProjectForEdit, notFoundResponse, projectLevel } from '@/lib/tenancy'
import { z } from 'zod'
import { getOwnedClient } from '@/lib/clients-server'

type Ctx = { params: Promise<{ id: string }> }

const targetSchema = z.object({
  nutrient: z.string().nullable().optional(),
  label: z.string().min(1).max(255),
  comparator: z.enum(['<=', '>=', '=', 'range']),
  value: z.number(),
  valueMax: z.number().optional(),
  unit: z.string().min(1).max(50),
  basis: z.enum(['per_serving', 'per_100g']),
  servingSizeG: z.number().positive().optional(),
})

const patchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  clientId: z.string().uuid().nullable().optional(),
  objectiveText: z.string().max(5000).nullable().optional(),
  status: z.enum(['active', 'archived']).optional(),
  targets: z.array(targetSchema).optional(),
})

export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params

  const project = await getOwnedProject(ctx, id)
  if (!project) return notFoundResponse()

  // One row per formulation: its latest iteration, plus how many iterations exist
  const latestPerFamily = await db
    .selectDistinctOn([formulations.familyId], {
      formulation: formulations,
      iterationCount: sql<number>`count(*) over (partition by ${formulations.familyId})::int`,
    })
    .from(formulations)
    .where(and(eq(formulations.projectId, id), eq(formulations.accountId, ctx.account.id)))
    .orderBy(formulations.familyId, desc(formulations.version))

  const formList = latestPerFamily
    .map(r => ({ ...r.formulation, iterationCount: r.iterationCount }))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())

  return NextResponse.json({ ...project, formulations: formList, canEdit: projectLevel(ctx, project) === 'edit' })
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  const loaded = await loadProjectForEdit(ctx, id)
  if (!loaded.ok) return loaded.res
  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  // The project's client name follows the linked client record (team access matches on it)
  let client: string | null | undefined
  if (parsed.data.clientId !== undefined) {
    const clientRow = parsed.data.clientId ? await getOwnedClient(ctx.account.id, parsed.data.clientId) : null
    if (parsed.data.clientId && !clientRow) return NextResponse.json({ error: 'Client not found' }, { status: 400 })
    client = clientRow?.name ?? null
  }
  // A member can't move a project to a client they couldn't edit it under
  if (client !== undefined && projectLevel(ctx, { id, client }) !== 'edit') {
    return NextResponse.json(
      { error: "You don't have edit access to that client's projects", code: 'forbidden' },
      { status: 403 },
    )
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  const d = parsed.data
  if (d.name !== undefined) updates.name = d.name
  if (client !== undefined) {
    updates.client = client
    updates.clientId = d.clientId ?? null
  }
  if (d.objectiveText !== undefined) updates.objectiveText = d.objectiveText
  if (d.status !== undefined) {
    updates.status = d.status
    // Archiving or restoring by hand ends any link to a client archive
    updates.archivedWithClientId = null
  }
  if (d.targets !== undefined) updates.targets = d.targets

  const [row] = await db
    .update(projects)
    .set(updates)
    .where(and(eq(projects.id, id), eq(projects.accountId, ctx.account.id)))
    .returning()
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(row)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  const loaded = await loadProjectForEdit(ctx, id)
  if (!loaded.ok) return loaded.res
  await db.delete(projects).where(and(eq(projects.id, id), eq(projects.accountId, ctx.account.id)))
  return new NextResponse(null, { status: 204 })
}
