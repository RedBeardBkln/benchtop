import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { projects, formulations } from '@/lib/db/schema'
import { and, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { projectLevel, visibleProjects } from '@/lib/tenancy'
import { canCreateProject } from '@/lib/team-access'
import { getOwnedClient } from '@/lib/clients-server'

const createSchema = z.object({
  name: z.string().min(1).max(255),
  clientId: z.string().uuid().nullable().optional(),
  objectiveText: z.string().max(5000).optional().or(z.literal('')),
})

export async function GET() {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      client: projects.client,
      clientId: projects.clientId,
      status: projects.status,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      formulationCount: sql<number>`count(distinct ${formulations.familyId})`.mapWith(Number),
    })
    .from(projects)
    .leftJoin(
      formulations,
      and(eq(projects.id, formulations.projectId), eq(formulations.accountId, ctx.account.id)),
    )
    .where(eq(projects.accountId, ctx.account.id))
    .groupBy(projects.id)
    .orderBy(desc(projects.updatedAt))

  return NextResponse.json(
    visibleProjects(ctx, rows).map(r => ({ ...r, canEdit: projectLevel(ctx, r) === 'edit' })),
  )
}

export async function POST(req: NextRequest) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { name, clientId, objectiveText } = parsed.data
  const clientRow = clientId ? await getOwnedClient(ctx.account.id, clientId) : null
  if (clientId && !clientRow) return NextResponse.json({ error: 'Client not found' }, { status: 400 })
  const client = clientRow?.name ?? null
  if (!canCreateProject(ctx.access, client)) {
    return NextResponse.json(
      {
        error: client
          ? `You don't have edit access to ${client} projects`
          : 'You can only create projects for clients you have edit access to',
        code: 'forbidden',
      },
      { status: 403 },
    )
  }

  const [row] = await db
    .insert(projects)
    .values({
      accountId: ctx.account.id,
      name,
      client,
      clientId: clientRow?.id ?? null,
      objectiveText: objectiveText || null,
    })
    .returning()

  return NextResponse.json(row, { status: 201 })
}
