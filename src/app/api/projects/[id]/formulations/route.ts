import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { formulations } from '@/lib/db/schema'
import { z } from 'zod'
import { getOwnedProject, notFoundResponse } from '@/lib/tenancy'

type Ctx = { params: Promise<{ id: string }> }

const createSchema = z.object({
  name: z.string().min(1).max(255),
  mode: z.enum(['ground_up', 'reverse']).default('ground_up'),
  servingSizeG: z.number().positive().nullable().optional(),
  batchSizeG: z.number().positive().nullable().optional(),
  notes: z.string().max(5000).optional().or(z.literal('')),
})

export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id: projectId } = await params
  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const project = await getOwnedProject(ctx, projectId)
  if (!project) return notFoundResponse()

  const { name, mode, servingSizeG, batchSizeG, notes } = parsed.data
  const newId = crypto.randomUUID()
  const [row] = await db
    .insert(formulations)
    .values({
      id: newId,
      accountId: ctx.account.id,
      familyId: newId,
      projectId,
      name,
      mode,
      servingSizeG: servingSizeG?.toString() ?? null,
      batchSizeG: batchSizeG?.toString() ?? null,
      notes: notes || null,
    })
    .returning()

  return NextResponse.json(row, { status: 201 })
}
