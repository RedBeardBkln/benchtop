import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { formulationNotes } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { isUuid, loadFormulationForEdit, notFoundResponse } from '@/lib/tenancy'

type Ctx = { params: Promise<{ id: string; noteId: string }> }

const patchSchema = z.object({
  body: z.string().trim().min(1).max(10000),
})

// Only the author can edit or delete a note, so the log stays a record of who concluded what
function ownNote(id: string, noteId: string, userId: string) {
  return and(
    eq(formulationNotes.id, noteId),
    eq(formulationNotes.formulationId, id),
    eq(formulationNotes.userId, userId),
  )
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id, noteId } = await params
  if (!isUuid(noteId)) return notFoundResponse()
  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const loaded = await loadFormulationForEdit(ctx, id)
  if (!loaded.ok) return loaded.res

  const [row] = await db
    .update(formulationNotes)
    .set({ body: parsed.data.body, updatedAt: new Date() })
    .where(ownNote(id, noteId, ctx.user.id))
    .returning()
  if (!row) return notFoundResponse('Note not found, or not yours to edit')

  return NextResponse.json({ ...row, mine: true })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id, noteId } = await params
  if (!isUuid(noteId)) return notFoundResponse()

  const loaded = await loadFormulationForEdit(ctx, id)
  if (!loaded.ok) return loaded.res

  const [row] = await db
    .delete(formulationNotes)
    .where(ownNote(id, noteId, ctx.user.id))
    .returning({ id: formulationNotes.id })
  if (!row) return notFoundResponse('Note not found, or not yours to delete')

  return NextResponse.json({ ok: true })
}
