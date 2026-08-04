import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { projects, formulations } from '@/lib/db/schema'
import { desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1).max(255),
  client: z.string().max(255).optional().or(z.literal('')),
  objectiveText: z.string().max(5000).optional().or(z.literal('')),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      client: projects.client,
      status: projects.status,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      formulationCount: sql<number>`count(${formulations.id})`.mapWith(Number),
    })
    .from(projects)
    .leftJoin(formulations, eq(projects.id, formulations.projectId))
    .groupBy(projects.id)
    .orderBy(desc(projects.updatedAt))

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { name, client, objectiveText } = parsed.data
  const [row] = await db
    .insert(projects)
    .values({
      name,
      client: client || null,
      objectiveText: objectiveText || null,
    })
    .returning()

  return NextResponse.json(row, { status: 201 })
}
