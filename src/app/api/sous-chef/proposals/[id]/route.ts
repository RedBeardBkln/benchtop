import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApi } from '@/lib/auth/context'
import { isUuid, notFoundResponse } from '@/lib/tenancy'
import { decideProposal } from '@/lib/sous-chef-proposals-server'

type Ctx = { params: Promise<{ id: string }> }

const bodySchema = z.object({ decision: z.enum(['approve', 'decline']) })

// Approve (apply) or decline a formulation change Sous Chef proposed in one of your conversations.
// Approving re-checks your edit access and that the formulation hasn't changed since.
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { id } = await params
  if (!isUuid(id)) return notFoundResponse()
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Choose approve or decline' }, { status: 400 })

  const { ctx } = auth
  const result = await decideProposal({ account: ctx.account, access: ctx.access, user: ctx.user }, id, parsed.data.decision)
  if (!result.ok) return NextResponse.json({ error: result.error, proposal: result.view ?? null }, { status: result.status })
  return NextResponse.json({ proposal: result.view })
}
