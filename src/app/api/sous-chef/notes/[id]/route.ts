import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { requireApi, type AuthContext } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { sousChefNotes } from '@/lib/db/schema'
import { notePatchSchema } from '@/lib/sous-chef'
import { loadNotes } from '@/lib/sous-chef-server'
import { isUuid, notFoundResponse } from '@/lib/tenancy'
import { isTeamAdmin } from '@/lib/team-access'

type Ctx = { params: Promise<{ id: string }> }

// The person who recorded a note (or whose conversation recorded it), and owners and admins, may change it
async function loadForEdit(ctx: AuthContext, id: string) {
  if (!isUuid(id)) return { ok: false as const, res: notFoundResponse() }
  const note = (await loadNotes(ctx, { includeRetired: true })).find(n => n.id === id)
  if (!note) return { ok: false as const, res: notFoundResponse() }
  if (!isTeamAdmin(ctx.role) && note.createdBy !== ctx.user.id)
    return { ok: false as const, res: NextResponse.json({ error: 'Only the person who recorded this note, or an admin, can change it' }, { status: 403 }) }
  return { ok: true as const, note }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth
  const loaded = await loadForEdit(ctx, (await params).id)
  if (!loaded.ok) return loaded.res

  const parsed = notePatchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid note' }, { status: 400 })
  const d = parsed.data
  const [row] = await db.update(sousChefNotes)
    .set({
      updatedAt: new Date(),
      ...(d.kind !== undefined && { kind: d.kind }),
      ...(d.content !== undefined && { content: d.content }),
      ...(d.retired !== undefined && { retiredAt: d.retired ? new Date() : null }),
    })
    .where(and(eq(sousChefNotes.id, loaded.note.id), eq(sousChefNotes.accountId, ctx.account.id)))
    .returning()
  return NextResponse.json(row)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth
  const loaded = await loadForEdit(ctx, (await params).id)
  if (!loaded.ok) return loaded.res

  await db.delete(sousChefNotes).where(and(eq(sousChefNotes.id, loaded.note.id), eq(sousChefNotes.accountId, ctx.account.id)))
  return NextResponse.json({ ok: true })
}
