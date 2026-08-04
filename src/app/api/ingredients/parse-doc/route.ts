import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB
const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf',
])

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData().catch(() => null)
  if (!formData) return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })

  const file = formData.get('file') as File | null
  const ingredientName = (formData.get('ingredientName') as string | null) ?? ''

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: 'Unsupported file type. Use PDF, JPEG, PNG, or WEBP.' },
      { status: 422 },
    )
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File too large (max 20 MB)' }, { status: 422 })
  }

  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')

  const anthropic = new Anthropic()

  const docPart = file.type === 'application/pdf'
    ? ({
        type: 'document' as const,
        source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 },
      })
    : ({
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
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
Allowed nutrient names: Energy, Protein, Total Fat, Saturated Fat, Trans Fat, Cholesterol, Total Carbohydrate, Dietary Fiber, Sugars, Added Sugars, Sodium, Calcium, Iron, Potassium, Vitamin A, Vitamin C, Vitamin D, Magnesium.
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
    return NextResponse.json({ nutrients: result.nutrients })
  } catch {
    return NextResponse.json({ error: 'Invalid AI response format' }, { status: 500 })
  }
}
