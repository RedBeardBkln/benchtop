import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { isUuid } from '@/lib/tenancy'
import { getIngredientCosts } from '@/lib/costing-server'

// GET ?ids=a,b,c → each ingredient's cost for formulations (COGS tab)
export async function GET(req: NextRequest) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const ids = [...new Set((req.nextUrl.searchParams.get('ids') ?? '').split(',').filter(isUuid))].slice(0, 500)
  return NextResponse.json(await getIngredientCosts(ctx.account.id, ids))
}
