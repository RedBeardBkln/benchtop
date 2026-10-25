import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { suppliers } from '@/lib/db/schema'
import { getOwnedSupplier, notFoundResponse } from '@/lib/tenancy'

type Ctx = { params: Promise<{ id: string }> }

// Brings an archived supplier back into the library, on its own (whatever it was archived with stays archived)
export async function POST(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi({ libraryEdit: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  const row = await getOwnedSupplier(ctx, id)
  if (!row) return notFoundResponse()

  await db.update(suppliers).set({ archivedAt: null, archivedWithClientId: null })
    .where(and(eq(suppliers.id, id), eq(suppliers.accountId, ctx.account.id)))
  return NextResponse.json({ ok: true })
}
