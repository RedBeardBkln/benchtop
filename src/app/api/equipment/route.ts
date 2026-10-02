import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { equipment } from '@/lib/db/schema'
import { asc, sql } from 'drizzle-orm'
import { z } from 'zod'

const postSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db.select().from(equipment).orderBy(asc(sql`lower(${equipment.name})`))
  return NextResponse.json(rows)
}

// Adds a piece of equipment; if one with the same name (ignoring case) exists, that one is returned instead
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = postSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }

  const { name } = parsed.data
  await db.insert(equipment).values({ name }).onConflictDoNothing()
  const [row] = await db.select().from(equipment).where(sql`lower(${equipment.name}) = lower(${name})`).limit(1)
  return NextResponse.json(row, { status: 201 })
}
