import { NextRequest, NextResponse } from 'next/server'
import { inArray } from 'drizzle-orm'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { profiles, sousChefNotes } from '@/lib/db/schema'
import { noteInputSchema } from '@/lib/sous-chef'
import { loadNotes, resolveNoteLinks } from '@/lib/sous-chef-server'
import { isTeamAdmin } from '@/lib/team-access'

// The team's lab notebook, retired notes included (the UI separates them)
export async function GET() {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const notes = await loadNotes(ctx, { includeRetired: true })
  const userIds = [...new Set(notes.map(n => n.createdBy))]
  const names = userIds.length
    ? await db.select({ userId: profiles.userId, fullName: profiles.fullName }).from(profiles).where(inArray(profiles.userId, userIds))
    : []
  const nameOf = new Map(names.map(n => [n.userId, n.fullName]))
  const admin = isTeamAdmin(ctx.role)

  return NextResponse.json(notes.map(({ createdBy, ...n }) => ({
    ...n,
    createdByName: nameOf.get(createdBy) || null,
    canEdit: admin || createdBy === ctx.user.id,
  })))
}

// Adds a note by hand
export async function POST(req: NextRequest) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const parsed = noteInputSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid note' }, { status: 400 })
  const links = await resolveNoteLinks(ctx, parsed.data)
  if (!links) return NextResponse.json({ error: 'Project or formulation not found' }, { status: 404 })

  const [row] = await db.insert(sousChefNotes).values({
    accountId: ctx.account.id, createdBy: ctx.user.id, kind: parsed.data.kind, content: parsed.data.content, ...links,
  }).returning()
  return NextResponse.json(row, { status: 201 })
}
