import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { equipment, processSteps } from '@/lib/db/schema'
import { and, asc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

const postSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
})

export async function GET() {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  // stepCount: how many process steps use it, so removing it can say what it affects
  const rows = await db
    .select({
      id: equipment.id,
      accountId: equipment.accountId,
      name: equipment.name,
      createdAt: equipment.createdAt,
      stepCount: sql<number>`(select count(*)::int from ${processSteps} where ${processSteps.equipmentId} = ${equipment.id})`,
    })
    .from(equipment)
    .where(eq(equipment.accountId, ctx.account.id))
    .orderBy(asc(sql`lower(${equipment.name})`))
  return NextResponse.json(rows)
}

// Adds a piece of equipment to the caller's account; if one with the same name (ignoring case) exists
// in that account, that one is returned instead
export async function POST(req: NextRequest) {
  const auth = await requireApi({ libraryEdit: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const parsed = postSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }

  const { name } = parsed.data
  await db.insert(equipment).values({ accountId: ctx.account.id, name }).onConflictDoNothing()
  const [row] = await db
    .select()
    .from(equipment)
    .where(and(eq(equipment.accountId, ctx.account.id), sql`lower(${equipment.name}) = lower(${name})`))
    .limit(1)
  return NextResponse.json(row, { status: 201 })
}
