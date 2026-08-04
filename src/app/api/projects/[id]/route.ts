import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { projects, formulations } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'

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
  client: z.string().max(255).nullable().optional(),
  objectiveText: z.string().max(5000).nullable().optional(),
  status: z.enum(['active', 'archived']).optional(),
  targets: z.array(targetSchema).optional(),
})

export async function GET(_req: NextRequest, { params }: Ctx) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const formList = await db
    .select()
    .from(formulations)
    .where(eq(formulations.projectId, id))
    .orderBy(desc(formulations.updatedAt))

  return NextResponse.json({ ...project, formulations: formList })
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  const d = parsed.data
  if (d.name !== undefined) updates.name = d.name
  if (d.client !== undefined) updates.client = d.client
  if (d.objectiveText !== undefined) updates.objectiveText = d.objectiveText
  if (d.status !== undefined) updates.status = d.status
  if (d.targets !== undefined) updates.targets = d.targets

  const [row] = await db.update(projects).set(updates).where(eq(projects.id, id)).returning()
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(row)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await db.delete(projects).where(eq(projects.id, id))
  return new NextResponse(null, { status: 204 })
}
