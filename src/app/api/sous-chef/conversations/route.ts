import { NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { loadConversations } from '@/lib/sous-chef-server'

// Your own Sous Chef conversations, most recent first, each with the project, formulation or iteration it's about
export async function GET() {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  return NextResponse.json(await loadConversations({ account: ctx.account, access: ctx.access, user: ctx.user }))
}
