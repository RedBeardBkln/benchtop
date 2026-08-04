import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { ingredientCerts } from '@/lib/db/schema'
import { z } from 'zod'

type Ctx = { params: Promise<{ id: string }> }

const schema = z.object({ cert: z.string().min(1).max(100) })

export async function POST(req: NextRequest, { params }: Ctx) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = schema.safeParse(await req.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 })

  const [row] = await db
    .insert(ingredientCerts)
    .values({ ingredientId: id, cert: body.data.cert })
    .onConflictDoNothing()
    .returning()

  return NextResponse.json(row ?? { cert: body.data.cert }, { status: 201 })
}
