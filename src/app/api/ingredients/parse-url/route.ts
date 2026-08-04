import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

const bodySchema = z.object({
  url: z.string().url(),
  ingredientName: z.string().min(1),
})

function isSafeUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    const h = url.hostname.toLowerCase()
    if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return false
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(h)) return false
    if (h.endsWith('.internal') || h.endsWith('.local')) return false
    return true
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { url, ingredientName } = parsed.data

  if (!isSafeUrl(url)) {
    return NextResponse.json({ error: 'URL not allowed' }, { status: 422 })
  }

  // Fetch page server-side to bypass CORS
  let pageText = ''
  try {
    const pageRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NutritionDataBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(12000),
    })
    if (!pageRes.ok) throw new Error(`HTTP ${pageRes.status}`)
    const html = await pageRes.text()

    // Strip scripts, styles, and tags — keep text content for Claude
    pageText = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 16000)
  } catch (err) {
    return NextResponse.json(
      { error: `Could not load page: ${String(err)}. Some sites block server-side requests.` },
      { status: 422 },
    )
  }

  if (pageText.length < 50) {
    return NextResponse.json(
      { error: 'Page content appears empty — this site may use JavaScript rendering.' },
      { status: 422 },
    )
  }

  const anthropic = new Anthropic()
  const completion = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: 'You are a nutrition data extraction assistant. Extract nutrition facts from web page text and return strict JSON. No markdown, no prose — only the JSON object.',
    messages: [{
      role: 'user',
      content: `Extract the nutrition facts for "${ingredientName}" from the page text below.
Convert all values to per-100g basis (use serving size if provided).
Return ONLY this JSON structure:
{
  "nutrients": [
    {"name": "Energy", "amountPer100g": 350, "unit": "kcal"},
    {"name": "Protein", "amountPer100g": 25.3, "unit": "g"}
  ]
}
Allowed nutrient names: Energy, Protein, Total Fat, Saturated Fat, Trans Fat, Cholesterol, Total Carbohydrate, Dietary Fiber, Sugars, Added Sugars, Sodium, Calcium, Iron, Potassium, Vitamin A, Vitamin C, Vitamin D, Magnesium.
If no nutrition data is found return: {"nutrients": [], "error": "No nutrition data found"}

Page text:
${pageText}`,
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
      return NextResponse.json({ error: result.error ?? 'No nutrition data found on this page' }, { status: 422 })
    }
    return NextResponse.json({ nutrients: result.nutrients })
  } catch {
    return NextResponse.json({ error: 'Invalid AI response format' }, { status: 500 })
  }
}
