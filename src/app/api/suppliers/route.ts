import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { suppliers } from '@/lib/db/schema'
import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1).max(255),
  websiteUrl: z.string().url().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export async function GET() {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const rows = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.accountId, ctx.account.id))
    .orderBy(asc(suppliers.name))
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { name, websiteUrl, notes } = parsed.data
  const [row] = await db
    .insert(suppliers)
    .values({ accountId: ctx.account.id, name, websiteUrl: websiteUrl ?? null, notes: notes ?? null })
    .returning()

  return NextResponse.json(row, { status: 201 })
}
