import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { suppliers } from '@/lib/db/schema'
import { asc } from 'drizzle-orm'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1).max(255),
  websiteUrl: z.string().url().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db.select().from(suppliers).orderBy(asc(suppliers.name))
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { name, websiteUrl, notes } = parsed.data
  const [row] = await db
    .insert(suppliers)
    .values({ name, websiteUrl: websiteUrl ?? null, notes: notes ?? null })
    .returning()

  return NextResponse.json(row, { status: 201 })
}
