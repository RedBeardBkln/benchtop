import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { z } from 'zod'
import { AdminNotConfiguredError } from '@/lib/supabase/admin'
import { isOwnStagedPath, readStaged, removeStaged, stagedFileName } from '@/lib/staged-upload'
import { DocParseError, docMediaType, extractNutrientsFromDoc } from '@/lib/doc-nutrients'

// Reads nutrition per 100 g from an uploaded spec sheet or COA, for an ingredient that isn't saved yet.
// Returns [{ nutrientId, name, unit, amountPer100g }] in each nutrient's own unit.

const bodySchema = z.object({
  // Where the browser uploaded the file (see lib/staged-upload)
  stagedPath: z.string().min(1).max(512),
  ingredientName: z.string().max(255).default(''),
  // Leave the file in staging so it can be attached to the ingredient once it's saved
  keep: z.boolean().default(false),
})

export async function POST(req: NextRequest) {
  const auth = await requireApi({ libraryEdit: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  const { stagedPath, keep } = parsed.data
  if (!isOwnStagedPath(ctx.account.id, stagedPath)) return NextResponse.json({ error: 'Upload not found' }, { status: 404 })

  let file: Awaited<ReturnType<typeof readStaged>>
  try {
    file = await readStaged(stagedPath)
    if (!keep) await removeStaged(stagedPath)
  } catch (err) {
    if (err instanceof AdminNotConfiguredError) {
      return NextResponse.json({ error: 'Document storage is not configured', code: 'storage_not_configured' }, { status: 503 })
    }
    throw err
  }
  if (!file) return NextResponse.json({ error: 'Upload not found or too large (max 20 MB)' }, { status: 422 })

  const mediaType = docMediaType(file.contentType, stagedFileName(stagedPath))
  if (!mediaType) {
    return NextResponse.json(
      { error: 'Unsupported file type. Use PDF, JPEG, PNG, or WEBP.' },
      { status: 422 },
    )
  }

  try {
    const nutrients = await extractNutrientsFromDoc(file.bytes, mediaType)
    if (nutrients.length === 0) {
      return NextResponse.json({ error: 'No nutrition data found in document' }, { status: 422 })
    }
    return NextResponse.json({ nutrients })
  } catch (err) {
    if (err instanceof DocParseError) return NextResponse.json({ error: err.message }, { status: 500 })
    throw err
  }
}
