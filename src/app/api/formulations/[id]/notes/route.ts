import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { formulationNotes } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getOwnedFormulation, notFoundResponse, loadFormulationForEdit } from '@/lib/tenancy'

type Ctx = { params: Promise<{ id: string }> }

const postSchema = z.object({
  body: z.string().trim().min(1).max(10000),
})

// Notes describe the work on an iteration rather than change it, so adding one is allowed on a locked
// iteration and doesn't bump the formulation's updatedAt. View-only members can read them but not write.
export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  if (!(await getOwnedFormulation(ctx, id))) return notFoundResponse()

  const notes = await db
    .select()
    .from(formulationNotes)
    .where(eq(formulationNotes.formulationId, id))
    .orderBy(desc(formulationNotes.createdAt))

  return NextResponse.json(notes.map(n => ({ ...n, mine: n.userId === ctx.user.id })))
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  const parsed = postSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const loaded = await loadFormulationForEdit(ctx, id)
  if (!loaded.ok) return loaded.res

  const [row] = await db
    .insert(formulationNotes)
    .values({
      formulationId: id,
      userId: ctx.user.id,
      authorEmail: ctx.user.email ?? null,
      body: parsed.data.body,
    })
    .returning()

  return NextResponse.json({ ...row, mine: true }, { status: 201 })
}
