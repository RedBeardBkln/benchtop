import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { formulationNfpPanels } from '@/lib/db/schema'
import { getOwnedFormulation, isUuid, notFoundResponse } from '@/lib/tenancy'

type Ctx = { params: Promise<{ id: string; panelId: string }> }

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res

  const { id, panelId } = await params
  if (!(await getOwnedFormulation(auth.ctx, id)) || !isUuid(panelId)) return notFoundResponse()

  // Scoped to the owned formulation, so a panel id from another iteration/account is a miss
  const deleted = await db
    .delete(formulationNfpPanels)
    .where(and(eq(formulationNfpPanels.id, panelId), eq(formulationNfpPanels.formulationId, id)))
    .returning({ id: formulationNfpPanels.id })

  if (deleted.length === 0) return notFoundResponse()
  return NextResponse.json({ ok: true })
}
