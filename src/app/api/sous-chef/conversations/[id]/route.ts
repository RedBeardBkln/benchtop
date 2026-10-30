import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { requireApi, type AuthContext } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { sousChefConversations, sousChefMessages } from '@/lib/db/schema'
import { isUuid, notFoundResponse } from '@/lib/tenancy'
import { conversationPatchSchema } from '@/lib/sous-chef'
import { loadConversations, resolveConversationLink, type SousChefScope } from '@/lib/sous-chef-server'

type Ctx = { params: Promise<{ id: string }> }

const scopeOf = (ctx: AuthContext): SousChefScope => ({ account: ctx.account, access: ctx.access, user: ctx.user })

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

  const [[summary], messages] = await Promise.all([loadConversations(scopeOf(auth.ctx), { id: conversation.id }), db
    .select({
      id: sousChefMessages.id, role: sousChefMessages.role, content: sousChefMessages.content,
      activity: sousChefMessages.activity, createdAt: sousChefMessages.createdAt,
    })
    .from(sousChefMessages)
    .where(eq(sousChefMessages.conversationId, conversation.id))
    .orderBy(sousChefMessages.createdAt)])
  return NextResponse.json({ ...summary, messages })
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const conversation = await loadOwn(auth.ctx, (await params).id)
  if (!conversation) return notFoundResponse()

  const parsed = conversationPatchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Give the conversation a name' }, { status: 400 })
  const { title, link } = parsed.data
  const scope = scopeOf(auth.ctx)
  // Linking (or unlinking with null) to a project, a whole formulation or one iteration
  const ids = link === undefined ? undefined : await resolveConversationLink(scope, link)
  if (ids === null) return notFoundResponse('That project or formulation no longer exists')
  if (title !== undefined || ids)
    await db.update(sousChefConversations).set({ ...(title !== undefined && { title }), ...ids })
      .where(eq(sousChefConversations.id, conversation.id))
  const [summary] = await loadConversations(scope, { id: conversation.id })
  return NextResponse.json(summary)
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
