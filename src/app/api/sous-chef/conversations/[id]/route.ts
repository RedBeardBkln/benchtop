import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireApi, type AuthContext } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { sousChefConversations, sousChefMessages } from '@/lib/db/schema'
import { isUuid, notFoundResponse } from '@/lib/tenancy'

type Ctx = { params: Promise<{ id: string }> }

const patchSchema = z.object({ title: z.string().trim().min(1).max(200) })

// Conversations are private to the person who started them
async function loadOwn(ctx: AuthContext, id: string) {
  if (!isUuid(id)) return null
  const [row] = await db.select().from(sousChefConversations)
    .where(and(
      eq(sousChefConversations.id, id),
      eq(sousChefConversations.accountId, ctx.account.id),
      eq(sousChefConversations.userId, ctx.user.id),
    )).limit(1)
  return row ?? null
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const conversation = await loadOwn(auth.ctx, (await params).id)
  if (!conversation) return notFoundResponse()

  const messages = await db
    .select({
      id: sousChefMessages.id, role: sousChefMessages.role, content: sousChefMessages.content,
      activity: sousChefMessages.activity, createdAt: sousChefMessages.createdAt,
    })
    .from(sousChefMessages)
    .where(eq(sousChefMessages.conversationId, conversation.id))
    .orderBy(sousChefMessages.createdAt)
  return NextResponse.json({ ...conversation, messages })
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const conversation = await loadOwn(auth.ctx, (await params).id)
  if (!conversation) return notFoundResponse()

  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Give the conversation a name' }, { status: 400 })
  const [row] = await db.update(sousChefConversations).set({ title: parsed.data.title })
    .where(eq(sousChefConversations.id, conversation.id)).returning()
  return NextResponse.json(row)
}

// Deletes the conversation and its messages. Notes recorded in it stay in the lab notebook.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const conversation = await loadOwn(auth.ctx, (await params).id)
  if (!conversation) return notFoundResponse()

  await db.delete(sousChefConversations).where(eq(sousChefConversations.id, conversation.id))
  return NextResponse.json({ ok: true })
}
