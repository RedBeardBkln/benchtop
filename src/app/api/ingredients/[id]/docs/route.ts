import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { ingredientDocs } from '@/lib/db/schema'
import { getOwnedIngredient, notFoundResponse } from '@/lib/tenancy'
import { AdminNotConfiguredError, DOCS_BUCKET, getSupabaseAdmin } from '@/lib/supabase/admin'
import {
  isOwnStagedPath, moveStaged, removeStaged, stagedFileName, stagedSize, STAGED_MAX_BYTES,
} from '@/lib/staged-upload'

type Ctx = { params: Promise<{ id: string }> }

const bodySchema = z.object({
  // Where the browser uploaded the file (see lib/staged-upload)
  stagedPath: z.string().min(1).max(512),
  label: z.string().trim().min(1, 'Label is required').max(255),
})

export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi({ libraryEdit: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  // Ownership is verified here; the storage calls below use the service role and bypass bucket policies
  if (!(await getOwnedIngredient(ctx, id))) return notFoundResponse()

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'file and label are required' }, { status: 400 })
  const { stagedPath, label } = parsed.data
  if (!isOwnStagedPath(ctx.account.id, stagedPath)) return NextResponse.json({ error: 'Upload not found' }, { status: 404 })

  // New uploads are namespaced by account; existing objects keep their old path (stored in file_path)
  const filePath = `${ctx.account.id}/${id}/${Date.now()}-${stagedFileName(stagedPath)}`

  try {
    const size = await stagedSize(stagedPath)
    if (size == null) return NextResponse.json({ error: 'Upload not found — try again' }, { status: 404 })
    if (size > STAGED_MAX_BYTES) {
      await removeStaged(stagedPath)
      return NextResponse.json({ error: 'File too large (max 20 MB)' }, { status: 413 })
    }
    const moveError = await moveStaged(stagedPath, filePath)
    if (moveError) return NextResponse.json({ error: `Storage upload failed: ${moveError.message}` }, { status: 500 })
  } catch (err) {
    if (err instanceof AdminNotConfiguredError) {
      return NextResponse.json({ error: 'Document storage is not configured', code: 'storage_not_configured' }, { status: 503 })
    }
    throw err
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
