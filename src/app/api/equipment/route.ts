import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { equipment } from '@/lib/db/schema'
import { and, asc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

const postSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
})

export async function GET() {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const rows = await db
    .select()
    .from(equipment)
    .where(eq(equipment.accountId, ctx.account.id))
    .orderBy(asc(sql`lower(${equipment.name})`))
  return NextResponse.json(rows)
}

// Adds a piece of equipment to the caller's account; if one with the same name (ignoring case) exists
// in that account, that one is returned instead
export async function POST(req: NextRequest) {
  const auth = await requireApi()
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
