import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { nutrients } from '@/lib/db/schema'
import Anthropic from '@anthropic-ai/sdk'

type MediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

function toMediaType(mime: string): MediaType {
  if (mime === 'image/png') return 'image/png'
  if (mime === 'image/webp') return 'image/webp'
  if (mime === 'image/gif') return 'image/gif'
  return 'image/jpeg'
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY)
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 })

  const formData = await req.formData().catch(() => null)
  if (!formData) return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })

  const SLOTS = ['label_photo', 'panel_photo', 'deck_photo'] as const
  type ImageBlock = { type: 'image'; source: { type: 'base64'; media_type: MediaType; data: string } }
  const imageBlocks: ImageBlock[] = []
  const slotLabels: string[] = []

  for (const slot of SLOTS) {
    const file = formData.get(slot) as File | null
    if (!file || !file.type.startsWith('image/')) continue
    if (file.size > 12 * 1024 * 1024) {
      return NextResponse.json({ error: `${slot} must be under 12 MB` }, { status: 400 })
    }
    const data = Buffer.from(await file.arrayBuffer()).toString('base64')
    imageBlocks.push({ type: 'image', source: { type: 'base64', media_type: toMediaType(file.type), data } })
    slotLabels.push(slot === 'label_photo' ? 'Product Label' : slot === 'panel_photo' ? 'Nutrition Facts Panel' : 'Ingredient Deck')
  }

  if (imageBlocks.length === 0)
    return NextResponse.json({ error: 'At least one photo is required' }, { status: 400 })

  const allNutrients = await db
    .select({ id: nutrients.id, name: nutrients.name, unit: nutrients.unit })
    .from(nutrients)
    .orderBy(nutrients.displayOrder)

  const nutrientList = allNutrients.map(n => `${n.id}|${n.name}|${n.unit}`).join('\n')
  const imageDesc = slotLabels.join(', ')

  const prompt = `You are analyzing ${imageBlocks.length} product photo(s): ${imageDesc}.
Synthesize all visible information across every image and return ONE JSON object. No markdown, no explanation.

{
  "name": "product name as sold",
  "labelName": "exact name printed on label or null",
  "isIsolateOrConcentrate": false,
  "naturallyDerived": true,
  "moisturePct": null,
  "notes": null,
  "nutrients": [
    { "nutrientId": "<uuid>", "amountPer100g": 0 }
  ],
  "allergens": ["Wheat"],
  "certs": ["Organic"],
  "subIngredients": [
    { "position": 1, "name": "Oat Fiber" }
  ]
}

Rules:
- name: commercial product name (e.g. "Whey Protein Isolate", "Oat Fiber 90").
- labelName: the exact as-printed label name if different from commercial name, else null.
- isIsolateOrConcentrate: true if product name contains Isolate, Concentrate, Hydrolysate, Extract.
- naturallyDerived: false only if clearly synthetic (artificial colors, chemical preservatives, etc.).
- moisturePct: numeric if stated on label (e.g. "moisture max 10%"), else null.
- notes: any important quality notes from the label (e.g. "cold-processed", "non-denatured"), else null.
- nutrients: match ONLY to the UUIDs in the list below. Convert per-serving values to per-100g using the stated serving size. Include only nutrients that are declared.
- allergens: extract from "Contains:" statement or parenthetical callouts. Use: Milk, Eggs, Fish, Shellfish, Tree Nuts, Peanuts, Wheat, Soybeans, Sesame.
- certs: use only: Organic, Non-GMO, Kosher, Halal, Vegan, Gluten-Free, Fair Trade, IP Non-GMO.
- subIngredients: list each ingredient from the ingredient deck in order (position 1-N). Flatten parentheticals — list sub-ingredients as separate entries.

NUTRIENT LIST (match nutrientId exactly — use UUID only, never the name):
${nutrientList}`

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          ...imageBlocks,
          { type: 'text', text: prompt },
        ],
      }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const json = raw.replace(/^```[a-z]*\n?/m, '').replace(/\n?```\s*$/m, '').trim()
    const parsed = JSON.parse(json)

    // Validate nutrient IDs against the fetched list
    const validIds = new Set(allNutrients.map(n => n.id))
    parsed.nutrients = (parsed.nutrients ?? []).filter((n: { nutrientId: string }) => validIds.has(n.nutrientId))

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[parse-photos]', err)
    return NextResponse.json({ error: 'AI parsing failed', detail: String(err) }, { status: 500 })
  }
}
