import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { projects, formulations } from '@/lib/db/schema'
import { and, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1).max(255),
  client: z.string().max(255).optional().or(z.literal('')),
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

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { name, client, objectiveText } = parsed.data
  const [row] = await db
    .insert(projects)
    .values({
      accountId: ctx.account.id,
      name,
      client: client || null,
      objectiveText: objectiveText || null,
    })
    .returning()

  return NextResponse.json(row, { status: 201 })
}
