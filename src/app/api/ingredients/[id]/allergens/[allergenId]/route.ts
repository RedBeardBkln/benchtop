import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { ingredientAllergens } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'

type Ctx = { params: Promise<{ id: string; allergenId: string }> }

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, allergenId } = await params

  await db
    .delete(ingredientAllergens)
    .where(and(eq(ingredientAllergens.id, allergenId), eq(ingredientAllergens.ingredientId, id)))

  return new NextResponse(null, { status: 204 })
}
