import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApi } from '@/lib/auth/context'
import { loadFormulationForEdit } from '@/lib/tenancy'
import { computeDepletions, loadBatchLines } from '@/lib/batch-depletion'

type Ctx = { params: Promise<{ id: string }> }

const bodySchema = z.object({ multiplier: z.number().positive().max(1000).default(1) })

// What completing a batch would take out of stock, without changing anything
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  const loaded = await loadFormulationForEdit(ctx, id)
  if (!loaded.ok) return loaded.res

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid multiplier' }, { status: 400 })

  const lines = await loadBatchLines(ctx.account.id, id)
  if (lines.length === 0)
    return NextResponse.json({ error: 'Formulation has no ingredient lines' }, { status: 422 })

  return NextResponse.json({ depletions: computeDepletions(lines, parsed.data.multiplier) })
}
