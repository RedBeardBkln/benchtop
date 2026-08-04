import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { ingredientDocs, nutrients } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

type Ctx = { params: Promise<{ id: string }> }

const BUCKET = 'ingredient-docs'

const IMAGE_TYPES: Record<string, 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
}

const bodySchema = z.object({ docId: z.string().uuid() })

export async function POST(req: NextRequest, { params }: Ctx) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const [doc] = await db
    .select()
    .from(ingredientDocs)
    .where(and(eq(ingredientDocs.id, parsed.data.docId), eq(ingredientDocs.ingredientId, id)))
    .limit(1)

  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  const ext = doc.filePath.split('.').pop()?.toLowerCase() ?? ''
  const isPdf = ext === 'pdf'
  const imageType = IMAGE_TYPES[ext]

  if (!isPdf && !imageType) {
    return NextResponse.json(
      { error: 'Only PDF and image files (JPG, PNG, WebP) can be parsed automatically' },
      { status: 400 }
    )
  }

  const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(doc.filePath)
  if (dlErr || !blob) {
    return NextResponse.json({ error: 'Failed to download document from storage' }, { status: 500 })
  }

  const base64 = Buffer.from(await blob.arrayBuffer()).toString('base64')

  const allNutrients = await db
    .select({ id: nutrients.id, name: nutrients.name, unit: nutrients.unit })
    .from(nutrients)
    .orderBy(nutrients.displayOrder)

  const nutrientList = allNutrients.map(n => `${n.id}|${n.name}|${n.unit}`).join('\n')

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const docContent = isPdf
    ? ({
        type: 'document' as const,
        source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 },
      })
    : ({
        type: 'image' as const,
        source: { type: 'base64' as const, media_type: imageType!, data: base64 },
      })

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          docContent,
          {
            type: 'text',
            text: `Extract all nutrient values from this food specification document, nutrition facts panel, or Certificate of Analysis.

All values must be expressed per 100 g of ingredient. If the document expresses values per serving, divide by the serving weight in grams and multiply by 100.

Match each nutrient to the list below using its exact UUID as nutrientId. Only use IDs from this list:
ID|Name|Unit
${nutrientList}

Return ONLY a valid JSON array with no surrounding text or markdown:
[{"nutrientId":"<uuid>","amountPer100g":<number>}]

Rules:
- Only include nutrients explicitly stated in the document
- If a value is given as "< X g", use X/2 as the estimate
- Exclude nutrients that are absent, trace, or not stated
- amountPer100g must be a non-negative finite number`,
          },
        ],
      },
    ],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''

  let results: Array<{ nutrientId: string; amountPer100g: number }> = []
  try {
    const match = raw.match(/\[[\s\S]*\]/)
    results = match ? JSON.parse(match[0]) : []
  } catch {
    return NextResponse.json({ error: 'Could not parse AI response', raw }, { status: 500 })
  }

  const validIds = new Set(allNutrients.map(n => n.id))
  const filtered = results.filter(
    r =>
      typeof r.nutrientId === 'string' &&
      validIds.has(r.nutrientId) &&
      typeof r.amountPer100g === 'number' &&
      isFinite(r.amountPer100g) &&
      r.amountPer100g >= 0
  )

  return NextResponse.json({ parsed: filtered, docLabel: doc.label, count: filtered.length })
}
