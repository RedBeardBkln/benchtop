import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { ingredientDocs } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'

type Ctx = { params: Promise<{ id: string; docId: string }> }

const BUCKET = 'ingredient-docs'

export async function GET(_req: NextRequest, { params }: Ctx) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, docId } = await params

  const [doc] = await db
    .select()
    .from(ingredientDocs)
    .where(and(eq(ingredientDocs.id, docId), eq(ingredientDocs.ingredientId, id)))
    .limit(1)

  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(doc.filePath, 300) // 5-minute URL

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ signedUrl: data.signedUrl })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, docId } = await params

  const [doc] = await db
    .select()
    .from(ingredientDocs)
    .where(and(eq(ingredientDocs.id, docId), eq(ingredientDocs.ingredientId, id)))
    .limit(1)

  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await supabase.storage.from(BUCKET).remove([doc.filePath])
  await db.delete(ingredientDocs).where(eq(ingredientDocs.id, docId))

  return new NextResponse(null, { status: 204 })
}
