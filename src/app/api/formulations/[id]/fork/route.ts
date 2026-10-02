import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { formulations } from '@/lib/db/schema'
import { duplicateFormulation } from '@/lib/duplicate-formulation'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

type Ctx = { params: Promise<{ id: string }> }

const bodySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255),
})

// "New Formulation": copies this formulation into a separate formulation (own family) at v1.
// For a new iteration of the same formulation, see ../iterate.
export async function POST(req: NextRequest, { params }: Ctx) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }

  const { id } = await params
  const [source] = await db.select().from(formulations).where(eq(formulations.id, id)).limit(1)
  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { name } = parsed.data
  if (name.toLowerCase() === source.name.trim().toLowerCase()) {
    return NextResponse.json({ error: 'Give the new formulation a different name' }, { status: 400 })
  }

  const created = await duplicateFormulation(source, { kind: 'formulation', name })
  return NextResponse.json(created, { status: 201 })
}
