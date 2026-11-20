import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApi } from '@/lib/auth/context'
import { isUuid, notFoundResponse } from '@/lib/tenancy'
import { decideProposal } from '@/lib/sous-chef-proposals-server'

type Ctx = { params: Promise<{ id: string }> }

const bodySchema = z.discriminatedUnion('decision', [
  // saveAs: as a new iteration, or over the iteration itself; left out = what Sous Chef suggested
  z.object({ decision: z.literal('approve'), saveAs: z.enum(['new_iteration', 'this_iteration']).optional() }),
  z.object({ decision: z.literal('decline') }),
  // force: revert even though the iteration was edited after the change (those edits are undone too)
  z.object({ decision: z.literal('revert'), force: z.boolean().optional() }),
])

// Approve (save), decline, or revert a formulation change Sous Chef proposed in one of your
// conversations. Saving and reverting re-check your edit access.
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { id } = await params
  if (!isUuid(id)) return notFoundResponse()
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Choose approve, decline or revert' }, { status: 400 })

  const { ctx } = auth
  const result = await decideProposal({ account: ctx.account, access: ctx.access, user: ctx.user }, id, parsed.data)
  if (!result.ok) {
    return NextResponse.json({ error: result.error, code: result.code ?? null, proposal: result.view ?? null }, { status: result.status })
  }
  return NextResponse.json({ proposal: result.view })
}
