import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

type Ctx = { params: Promise<{ id: string }> }

const PROMPT = `Analyze this product label image and extract every piece of information visible. Return ONLY a valid JSON object — no markdown, no explanation — with this exact structure:

{
  "productName": "string",
  "servingSizeG": number_or_null,
  "nutrients": [
    { "name": "string", "value": number, "unit": "string" }
  ],
  "deckIngredients": [
    { "name": "string", "subIngredients": ["string"] }
  ],
  "claims": ["string"],
  "impliedConstraints": [
    { "claim": "string", "constraint": "string" }
  ]
}

Rules:
- productName: full product name as printed on the package.
- servingSizeG: convert to grams (1 oz = 28.35 g, 1 fl oz ≈ 30 g, 1 cup ≈ 240 g). Return null if not determinable.
- nutrients: include ALL declared nutrients, even those with value 0. Use standard names: Energy (kcal), Protein (g), Total Fat (g), Saturated Fat (g), Trans Fat (g), Cholesterol (mg), Sodium (mg), Total Carbohydrate (g), Dietary Fiber (g), Total Sugars (g), Added Sugars (g), Vitamin D (mcg), Calcium (mg), Iron (mg), Potassium (mg). Use the panel's unit if different.
- deckIngredients: list IN ORDER as declared. For parenthetical sub-ingredients like "Oat Fiber (Oat Hull Fiber, Oat Bran)", put "Oat Fiber" as name and ["Oat Hull Fiber","Oat Bran"] in subIngredients. Parenthetical-only items (e.g. "contains: soy") go as claims.
- claims: any label claims, certifications, or statements (e.g. "Vegan","Non-GMO","Gluten Free","Palm Oil Free","Organic","Kosher","Made in a nut-free facility").
- impliedConstraints: for each claim that restricts formulation, add an entry:
  "Vegan" → "No animal-derived ingredients (dairy, eggs, meat, honey, gelatin, carmine, lanolin, etc.)"
  "Palm Oil Free" → "No palm oil, palm kernel oil, or any palm-derived fraction"
  "Gluten Free" → "No wheat, barley, rye, triticale, or contaminated oats"
  "Kosher" → "No pork or shellfish; no mixing of dairy and meat"
  "Halal" → "No pork or alcohol-derived ingredients"
  Other claims should generate sensible constraints.`

export async function POST(req: NextRequest, { params: _params }: Ctx) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured in .env.local' }, { status: 503 })
  }

  const formData = await req.formData().catch(() => null)
  if (!formData) return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })

  const file = formData.get('image') as File | null
  if (!file || !file.type.startsWith('image/'))
    return NextResponse.json({ error: 'An image file is required' }, { status: 400 })

  if (file.size > 12 * 1024 * 1024)
    return NextResponse.json({ error: 'Image must be under 12 MB' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const base64 = buffer.toString('base64')
  const mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' =
    file.type === 'image/png'  ? 'image/png'
    : file.type === 'image/webp' ? 'image/webp'
    : file.type === 'image/gif'  ? 'image/gif'
    : 'image/jpeg'

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: PROMPT },
        ],
      }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    // Strip any accidental markdown fencing
    const json = raw.replace(/^```[a-z]*\n?/m, '').replace(/\n?```\s*$/m, '').trim()
    return NextResponse.json(JSON.parse(json))
  } catch (err) {
    console.error('[parse-label]', err)
    return NextResponse.json({ error: 'AI parsing failed', detail: String(err) }, { status: 500 })
  }
}
