import { NextRequest, NextResponse } from 'next/server'
import { canonicalNutrientName } from '@/lib/nutrient-names'
import { requireApi } from '@/lib/auth/context'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { AdminNotConfiguredError } from '@/lib/supabase/admin'
import { isOwnStagedPath, readStaged, removeStaged, stagedFileName } from '@/lib/staged-upload'

const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf',
])
const TYPE_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
}

const bodySchema = z.object({
  // Where the browser uploaded the file (see lib/staged-upload); it's deleted once read
  stagedPath: z.string().min(1).max(512),
  ingredientName: z.string().max(255).default(''),
})

export async function POST(req: NextRequest) {
  const auth = await requireApi({ libraryEdit: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  const { stagedPath, ingredientName } = parsed.data
  if (!isOwnStagedPath(ctx.account.id, stagedPath)) return NextResponse.json({ error: 'Upload not found' }, { status: 404 })

  let file: Awaited<ReturnType<typeof readStaged>>
  try {
    file = await readStaged(stagedPath)
    // Only needed for this one read
    await removeStaged(stagedPath)
  } catch (err) {
    if (err instanceof AdminNotConfiguredError) {
      return NextResponse.json({ error: 'Document storage is not configured', code: 'storage_not_configured' }, { status: 503 })
    }
    throw err
  }
  if (!file) return NextResponse.json({ error: 'Upload not found or too large (max 20 MB)' }, { status: 422 })

  const ext = stagedFileName(stagedPath).split('.').pop()?.toLowerCase() ?? ''
  const mediaType = ALLOWED_TYPES.has(file.contentType) ? file.contentType : TYPE_BY_EXT[ext]
  if (!mediaType || !ALLOWED_TYPES.has(mediaType)) {
    return NextResponse.json(
      { error: 'Unsupported file type. Use PDF, JPEG, PNG, or WEBP.' },
      { status: 422 },
    )
  }

  const base64 = file.bytes.toString('base64')

  const anthropic = new Anthropic()

  const docPart = mediaType === 'application/pdf'
    ? ({
        type: 'document' as const,
        source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 },
      })
    : ({
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
          data: base64,
        },
      })

  const completion = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: 'You are a nutrition data extraction assistant. Extract nutrition facts from a COA or spec sheet and return strict JSON. No markdown, no prose — only the JSON object.',
    messages: [{
      role: 'user',
      content: [
        docPart,
        {
          type: 'text',
          text: `Extract the nutrition facts for "${ingredientName || 'this ingredient'}" from the document.
Convert all values to per-100g basis (divide by serving size if needed, or use the per-100g column directly).
Return ONLY this JSON structure:
{
  "nutrients": [
    {"name": "Energy", "amountPer100g": 350, "unit": "kcal"},
    {"name": "Protein", "amountPer100g": 25.3, "unit": "g"}
  ]
}
Allowed nutrient names: Energy, Protein, Total Fat, Saturated Fat, Trans Fat, Cholesterol, Total Carbohydrate, Dietary Fiber, Total Sugars, Added Sugars, Sodium, Calcium, Iron, Potassium, Vitamin A, Vitamin C, Vitamin D, Magnesium.
If no nutrition data is found return: {"nutrients": [], "error": "No nutrition data found"}`,
        },
      ],
    }],
  })

  const content = completion.content[0]
  if (content.type !== 'text') {
    return NextResponse.json({ error: 'AI response error' }, { status: 500 })
  }

  const jsonMatch = content.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return NextResponse.json({ error: 'Could not parse AI response' }, { status: 500 })
  }

  try {
    const result = JSON.parse(jsonMatch[0]) as { nutrients: unknown[]; error?: string }
    if (result.error || !result.nutrients?.length) {
      return NextResponse.json(
        { error: result.error ?? 'No nutrition data found in document' },
        { status: 422 },
      )
    }
    // Older answers say "Sugars" etc.; hand back the library's names so nothing is dropped
    const nutrients = (result.nutrients as Array<{ name?: unknown }>).map(n =>
      typeof n?.name === 'string' ? { ...n, name: canonicalNutrientName(n.name) } : n)
    return NextResponse.json({ nutrients })
  } catch {
    return NextResponse.json({ error: 'Invalid AI response format' }, { status: 500 })
  }
}
