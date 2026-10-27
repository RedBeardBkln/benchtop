import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { ingredientDocs } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getOwnedIngredient, notFoundResponse } from '@/lib/tenancy'
import { DocParseError, docMediaType, extractNutrientsFromDoc } from '@/lib/doc-nutrients'
import { AdminNotConfiguredError, DOCS_BUCKET, getSupabaseAdmin } from '@/lib/supabase/admin'

type Ctx = { params: Promise<{ id: string }> }

const bodySchema = z.object({ docId: z.string().uuid() })

export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi({ libraryEdit: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  if (!(await getOwnedIngredient(ctx, id))) return notFoundResponse()
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const [doc] = await db
    .select()
    .from(ingredientDocs)
    .where(and(eq(ingredientDocs.id, parsed.data.docId), eq(ingredientDocs.ingredientId, id)))
    .limit(1)

  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  const mediaType = docMediaType(null, doc.filePath)
  if (!mediaType) {
    return NextResponse.json(
      { error: 'Only PDF and image files (JPG, PNG, WebP) can be parsed automatically' },
      { status: 400 }
    )
  }

  let dl: { data: Blob | null; error: unknown }
  try {
    dl = await getSupabaseAdmin().storage.from(DOCS_BUCKET).download(doc.filePath)
  } catch (err) {
    if (err instanceof AdminNotConfiguredError) {
      return NextResponse.json({ error: 'Document storage is not configured', code: 'storage_not_configured' }, { status: 503 })
    }
    throw err
  }
  const { data: blob, error: dlErr } = dl
  if (dlErr || !blob) {
    return NextResponse.json({ error: 'Failed to download document from storage' }, { status: 500 })
  }

  let found
  try {
    found = await extractNutrientsFromDoc(Buffer.from(await blob.arrayBuffer()), mediaType)
  } catch (err) {
    if (err instanceof DocParseError) return NextResponse.json({ error: err.message }, { status: 500 })
    throw err
  }
  const filtered = found.map(n => ({ nutrientId: n.nutrientId, amountPer100g: n.amountPer100g }))

  return NextResponse.json({ parsed: filtered, docLabel: doc.label, count: filtered.length })
}
