import { NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { sousChefConversations } from '@/lib/db/schema'

// Your own Sous Chef conversations, most recent first
export async function GET() {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const rows = await db
    .select({
      id: sousChefConversations.id,
      title: sousChefConversations.title,
      projectId: sousChefConversations.projectId,
      formulationId: sousChefConversations.formulationId,
      updatedAt: sousChefConversations.updatedAt,
    })
    .from(sousChefConversations)
    .where(and(eq(sousChefConversations.accountId, ctx.account.id), eq(sousChefConversations.userId, ctx.user.id)))
    .orderBy(desc(sousChefConversations.updatedAt))
    .limit(200)
  return NextResponse.json(rows)
}
