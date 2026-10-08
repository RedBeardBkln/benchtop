import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { ingredientDocs } from '@/lib/db/schema'
import { getOwnedIngredient, notFoundResponse } from '@/lib/tenancy'
import { AdminNotConfiguredError, DOCS_BUCKET, ensureDocsBucket, getSupabaseAdmin } from '@/lib/supabase/admin'

type Ctx = { params: Promise<{ id: string }> }

const MAX_BYTES = 20 * 1024 * 1024 // 20 MB

export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  // Ownership is verified here; the storage calls below use the service role and bypass bucket policies
  if (!(await getOwnedIngredient(ctx, id))) return notFoundResponse()

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
  // New uploads are namespaced by account; existing objects keep their old path (stored in file_path)
  const filePath = `${ctx.account.id}/${id}/${Date.now()}-${safeName}`

  let uploadError: { message: string } | null
  try {
    const upload = () =>
      getSupabaseAdmin()
        .storage.from(DOCS_BUCKET)
        .upload(filePath, file, { contentType: file.type, upsert: false })
    let result = await upload()
    if (result.error && /bucket not found/i.test(result.error.message)) {
      const createError = await ensureDocsBucket()
      if (!createError) result = await upload()
    }
    uploadError = result.error
  } catch (err) {
    if (err instanceof AdminNotConfiguredError) {
      return NextResponse.json({ error: 'Document storage is not configured', code: 'storage_not_configured' }, { status: 503 })
    }
    throw err
  }

  if (uploadError) {
    return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 })
  }

  try {
    const [row] = await db
      .insert(ingredientDocs)
      .values({ ingredientId: id, filePath, label })
      .returning()
    return NextResponse.json(row, { status: 201 })
  } catch (err) {
    // The file is already in Storage; don't leave an orphan if the row couldn't be saved
    await getSupabaseAdmin().storage.from(DOCS_BUCKET).remove([filePath])
    console.error('ingredient_docs insert failed', err)
    return NextResponse.json({ error: 'Saved the file but could not record it in the database' }, { status: 500 })
  }
}
