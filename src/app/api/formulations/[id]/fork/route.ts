import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { getOwnedFormulation, notFoundResponse } from '@/lib/tenancy'
import { duplicateFormulation } from '@/lib/duplicate-formulation'
import { z } from 'zod'

type Ctx = { params: Promise<{ id: string }> }

const bodySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255),
})

// "New Formulation": copies this formulation into a separate formulation (own family) at v1.
// For a new iteration of the same formulation, see ../iterate.
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }

  const { id } = await params
  const source = await getOwnedFormulation(ctx, id)
  if (!source) return notFoundResponse()

  const { name } = parsed.data
  if (name.toLowerCase() === source.name.trim().toLowerCase()) {
    return NextResponse.json({ error: 'Give the new formulation a different name' }, { status: 400 })
  }

  const created = await duplicateFormulation(source, { kind: 'formulation', name })
  return NextResponse.json(created, { status: 201 })
}
