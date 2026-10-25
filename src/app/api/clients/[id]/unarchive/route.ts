import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApi } from '@/lib/auth/context'
import { getOwnedClient } from '@/lib/clients-server'
import { loadRestorePlan, unarchiveClient } from '@/lib/client-archive'
import { notFoundResponse } from '@/lib/tenancy'

type Ctx = { params: Promise<{ id: string }> }

// GET: the archived projects, formulations, ingredients and suppliers that unarchiving can bring back
export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi({ teamAdmin: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  const client = await getOwnedClient(ctx.account.id, id)
  if (!client) return notFoundResponse()
  return NextResponse.json(await loadRestorePlan(ctx.account.id, id))
}

const ids = z.array(z.string().uuid()).max(5000).default([])
const unarchiveSchema = z.object({ projectIds: ids, familyIds: ids, ingredientIds: ids, supplierIds: ids })

export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi({ teamAdmin: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  const client = await getOwnedClient(ctx.account.id, id)
  if (!client) return notFoundResponse()

  const parsed = unarchiveSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid selection' }, { status: 400 })

  await unarchiveClient(ctx.account.id, id, parsed.data)
  return NextResponse.json({ ok: true })
}
