import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApi } from '@/lib/auth/context'
import { loadClientForChange } from '@/lib/clients-server'
import { archiveClient, loadArchivePlan } from '@/lib/client-archive'

type Ctx = { params: Promise<{ id: string }> }

// GET: what archiving would touch, and which ingredients and suppliers may go with it
export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  const loaded = await loadClientForChange(ctx, id, 'manage')
  if (!loaded.ok) return loaded.res
  return NextResponse.json(await loadArchivePlan(ctx.account.id, id))
}

const archiveSchema = z.object({
  ingredientIds: z.array(z.string().uuid()).max(5000).default([]),
  supplierIds: z.array(z.string().uuid()).max(5000).default([]),
})

export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  const loaded = await loadClientForChange(ctx, id, 'manage')
  if (!loaded.ok) return loaded.res
  const client = loaded.client
  if (client.archivedAt) return NextResponse.json({ error: 'This client is already archived' }, { status: 409 })

  const parsed = archiveSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid selection' }, { status: 400 })

  const result = await archiveClient(ctx.account.id, id, [...new Set(parsed.data.ingredientIds)], [...new Set(parsed.data.supplierIds)])
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 409 })
  return NextResponse.json({ ok: true })
}
