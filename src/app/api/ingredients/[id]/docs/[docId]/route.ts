import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { ingredientDocs } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { getOwnedIngredient, notFoundResponse } from '@/lib/tenancy'
import { AdminNotConfiguredError, DOCS_BUCKET, getSupabaseAdmin } from '@/lib/supabase/admin'

type Ctx = { params: Promise<{ id: string; docId: string }> }

function storageNotConfigured() {
  return NextResponse.json({ error: 'Document storage is not configured', code: 'storage_not_configured' }, { status: 503 })
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id, docId } = await params
  if (!(await getOwnedIngredient(ctx, id))) return notFoundResponse()

  const [doc] = await db
    .select()
    .from(ingredientDocs)
    .where(and(eq(ingredientDocs.id, docId), eq(ingredientDocs.ingredientId, id)))
    .limit(1)

  if (!doc) return notFoundResponse()

  let signed: Awaited<ReturnType<ReturnType<ReturnType<typeof getSupabaseAdmin>['storage']['from']>['createSignedUrl']>>
  try {
    signed = await getSupabaseAdmin().storage.from(DOCS_BUCKET).createSignedUrl(doc.filePath, 300) // 5-minute URL
  } catch (err) {
    if (err instanceof AdminNotConfiguredError) return storageNotConfigured()
    throw err
  }
  const { data, error } = signed

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ signedUrl: data.signedUrl })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id, docId } = await params
  if (!(await getOwnedIngredient(ctx, id))) return notFoundResponse()

  const [doc] = await db
    .select()
    .from(ingredientDocs)
    .where(and(eq(ingredientDocs.id, docId), eq(ingredientDocs.ingredientId, id)))
    .limit(1)

  if (!doc) return notFoundResponse()

  try {
    await getSupabaseAdmin().storage.from(DOCS_BUCKET).remove([doc.filePath])
  } catch (err) {
    if (err instanceof AdminNotConfiguredError) return storageNotConfigured()
    throw err
  }
  await db.delete(ingredientDocs).where(eq(ingredientDocs.id, docId))

  return new NextResponse(null, { status: 204 })
}
