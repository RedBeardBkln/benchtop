import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { ingredientDocs } from '@/lib/db/schema'

type Ctx = { params: Promise<{ id: string }> }

const BUCKET = 'ingredient-docs'
const MAX_BYTES = 20 * 1024 * 1024 // 20 MB

export async function POST(req: NextRequest, { params }: Ctx) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const label = (formData.get('label') as string | null)?.trim()

  if (!file || !label) {
    return NextResponse.json({ error: 'file and label are required' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large (max 20 MB)' }, { status: 413 })
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const filePath = `${id}/${Date.now()}-${safeName}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const [row] = await db
    .insert(ingredientDocs)
    .values({ ingredientId: id, filePath, label })
    .returning()

  return NextResponse.json(row, { status: 201 })
}
