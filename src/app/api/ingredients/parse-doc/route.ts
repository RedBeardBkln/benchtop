import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { z } from 'zod'
import { AdminNotConfiguredError } from '@/lib/supabase/admin'
import { isOwnStagedPath, readStaged, removeStaged, stagedFileName } from '@/lib/staged-upload'
import { DocParseError, docMediaType, extractNutrientsFromDoc } from '@/lib/doc-nutrients'
import { getClaude } from '@/lib/ai/access'
import { extractIngredientInfoFromDoc } from '@/lib/doc-ingredient-info'
import { loadTaxonomyEntries } from '@/lib/ingredient-taxonomy'

// Reads nutrition per 100 g from an uploaded spec sheet or COA, for an ingredient that isn't saved yet.
// Returns [{ nutrientId, name, unit, amountPer100g }] in each nutrient's own unit.
// With `info: true` it also reads the ingredient's details (name, supplier, item code, category, …) and
// answers 200 whenever either part was read, with `nutrientsError` saying why no nutrition was found.

const bodySchema = z.object({
  // Where the browser uploaded the file (see lib/staged-upload)
  stagedPath: z.string().min(1).max(512),
  ingredientName: z.string().max(255).default(''),
  // Leave the file in staging so it can be attached to the ingredient once it's saved
  keep: z.boolean().default(false),
  // Also read the ingredient's details, for the Add ingredient form
  info: z.boolean().default(false),
})

export async function POST(req: NextRequest) {
  const auth = await requireApi({ libraryEdit: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  const { stagedPath, keep, info } = parsed.data
  if (!isOwnStagedPath(ctx.account.id, stagedPath)) return NextResponse.json({ error: 'Upload not found' }, { status: 404 })

  // Before reading the upload, which removes it from staging
  const grant = await getClaude(ctx, 'doc_nutrients')
  if (!grant.ok) return grant.res

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

  const noNutrients = (unconvertible: string[]) => unconvertible.length > 0
    ? `No nutrient could be read in a usable unit: ${unconvertible.join(', ')}`
    : 'No nutrition data found in document'

  if (!info) {
    try {
      const { nutrients, unconvertible } = await extractNutrientsFromDoc(file.bytes, mediaType, grant.ai)
      if (nutrients.length === 0) return NextResponse.json({ error: noNutrients(unconvertible) }, { status: 422 })
      return NextResponse.json({ nutrients, unconvertible })
    } catch (err) {
      if (err instanceof DocParseError) return NextResponse.json({ error: err.message }, { status: 500 })
      throw err
    }
  }

  // Both reads at once; either can come back empty or fail without losing the other
  const ai = grant.ai
  const [nutrientResult, infoResult] = await Promise.allSettled([
    extractNutrientsFromDoc(file.bytes, mediaType, ai),
    loadTaxonomyEntries(ctx.account.id).then(taxonomy => extractIngredientInfoFromDoc(file.bytes, mediaType, taxonomy, ai)),
  ])
  if (infoResult.status === 'rejected') console.error('parse-doc: reading ingredient details failed:', infoResult.reason)
  if (nutrientResult.status === 'rejected' && !(nutrientResult.reason instanceof DocParseError)) {
    console.error('parse-doc: reading nutrition failed:', nutrientResult.reason)
  }
  const details = infoResult.status === 'fulfilled' ? infoResult.value : null
  const found = nutrientResult.status === 'fulfilled' ? nutrientResult.value : null
  const nutrients = found?.nutrients ?? []
  if (!details && nutrients.length === 0) {
    return NextResponse.json({ error: found ? noNutrients(found.unconvertible) : 'Could not read the document' }, { status: 422 })
  }
  return NextResponse.json({
    nutrients,
    unconvertible: found?.unconvertible ?? [],
    nutrientsError: nutrients.length > 0 ? null : found ? noNutrients(found.unconvertible) : 'Could not read the nutrition',
    info: details,
  })
}
