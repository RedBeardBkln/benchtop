import { NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { isTeamAdmin } from '@/lib/team-access'
import { resolveBranding } from '@/lib/logo'

// The signed-in user's logos: the one to use on documents, their own, and the team's (see lib/logo).
export async function GET() {
  const auth = await requireApi({ allowUnentitled: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  return NextResponse.json({
    ...resolveBranding(ctx.account.id, ctx.profile?.logoPath, ctx.account.logoPath),
    isTeamAdmin: isTeamAdmin(ctx.role),
  })
}
