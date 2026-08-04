import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

type Ctx = { params: Promise<{ id: string }> }

const bodySchema = z.object({
  productName: z.string(),
  servingSizeG: z.number().nullable(),
  nutrients: z.array(z.object({ name: z.string(), value: z.number(), unit: z.string() })),
  deckIngredients: z.array(z.object({
    rawName: z.string(),
    subIngredients: z.array(z.string()).default([]),
    linkedIngredientName: z.string().nullable(),
    status: z.string(),
  })),
  claims: z.array(z.string()),
  impliedConstraints: z.array(z.string()),
})

function buildPrompt(d: z.infer<typeof bodySchema>): string {
  const nutrients = d.nutrients.map(n => `  • ${n.name}: ${n.value} ${n.unit}`).join('\n') || '  (none provided)'
  const deck = d.deckIngredients.map((ing, i) => {
    const sub = ing.subIngredients.length ? ` (${ing.subIngredients.join(', ')})` : ''
    const link = ing.linkedIngredientName ? ` → linked: "${ing.linkedIngredientName}"` : ' [unlinked]'
    return `  ${i + 1}. ${ing.rawName}${sub}${link}`
  }).join('\n') || '  (none provided)'
  const unlinked = d.deckIngredients.filter(i => i.status === 'unlinked').map(i => `  • "${i.rawName}"`).join('\n') || '  (none)'
  const claims = d.claims.join(', ') || 'none'
  const constraints = d.impliedConstraints.join('; ') || 'none'

  return `You are an expert food scientist. Reverse-engineer this product. Be CONCISE — keep every "rationale" and "additionalNotes" field to one short sentence. Return ONLY a raw JSON object (no markdown fences, no prose, no backticks).

PRODUCT: ${d.productName || 'Unknown'}
SERVING SIZE: ${d.servingSizeG ? `${d.servingSizeG} g` : 'not declared'}

NUTRITIONAL PANEL (per serving):
${nutrients}

INGREDIENT DECK (declared order):
${deck}

UNLINKED INGREDIENTS:
${unlinked}

CLAIMS: ${claims}
CONSTRAINTS: ${constraints}

JSON structure (return exactly this, no extra keys):
{"productCategory":"string","formulationApproach":"2 sentences max","ingredientSuggestions":[{"rawName":"string","suggestions":[{"ingredient":"string","rationale":"1 sentence","searchQuery":"string"}]}],"approximatePercentages":[{"ingredient":"string","estimatedMinPct":0,"estimatedMaxPct":0,"rationale":"1 sentence"}],"constraints":["string"],"additionalNotes":"2 sentences max"}`
}

export async function POST(req: NextRequest, { params: _params }: Ctx) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY)
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 503 })

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      messages: [{ role: 'user', content: buildPrompt(parsed.data) }],
    })

    if (message.stop_reason === 'max_tokens') {
      console.error('[ai-research] Response truncated at max_tokens')
      return NextResponse.json({ error: 'AI response was too long and got cut off. Try with fewer ingredients.' }, { status: 500 })
    }

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    // Extract the outermost JSON object: find first { and last }
    const start = raw.indexOf('{')
    const end   = raw.lastIndexOf('}')
    const json  = start !== -1 && end > start ? raw.slice(start, end + 1) : raw.trim()
    let result: unknown
    try {
      result = JSON.parse(json)
    } catch {
      const snippet = raw.slice(0, 300)
      console.error('[ai-research] JSON parse failed. Raw snippet:', snippet)
      return NextResponse.json(
        { error: `Claude returned non-JSON output. First 300 chars: ${snippet}` },
        { status: 500 }
      )
    }
    return NextResponse.json(result)
  } catch (err) {
    console.error('[ai-research]', err)
    return NextResponse.json({ error: 'AI research failed', detail: String(err) }, { status: 500 })
  }
}
