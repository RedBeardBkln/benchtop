import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const bodySchema = z.object({
  query: z.string().min(1).max(200),
})

type SearchResult = { title: string; url: string; snippet: string }

function curatedLinks(query: string): SearchResult[] {
  const enc = encodeURIComponent(query)
  const slug = encodeURIComponent(query.toLowerCase().replace(/\s+/g, '-'))
  return [
    {
      title: 'USDA FoodData Central',
      url: `https://fdc.nal.usda.gov/food-search?query=${enc}`,
      snippet: 'Official USDA database — Foundation, SR Legacy, and branded foods',
    },
    {
      title: 'NutritionValue.org',
      url: `https://www.nutritionvalue.org/?search=${enc}`,
      snippet: 'Detailed macros and micronutrients per 100 g — great for commodity ingredients',
    },
    {
      title: 'myfooddata.com',
      url: `https://tools.myfooddata.com/?food=${enc}`,
      snippet: 'Interactive nutrition facts with FDA-style panel and per-100g breakdown',
    },
    {
      title: 'Nutritionix',
      url: `https://www.nutritionix.com/food/${slug}`,
      snippet: 'Branded and generic ingredient nutrition data',
    },
    {
      title: 'Google — nutrition facts per 100g',
      url: `https://www.google.com/search?q=${encodeURIComponent(query + ' nutrition facts per 100g')}`,
      snippet: 'General web search — find the specific page, then paste its URL in the field below',
    },
  ]
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { query } = parsed.data
  const braveKey = process.env.BRAVE_SEARCH_API_KEY

  if (!braveKey) {
    return NextResponse.json({ results: curatedLinks(query), source: 'curated' })
  }

  try {
    const searchQuery = `${query} nutrition facts per 100g`
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(searchQuery)}&count=6&result_filter=web`,
      {
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': braveKey,
        },
        signal: AbortSignal.timeout(10000),
      },
    )

    if (!res.ok) throw new Error(`Brave API ${res.status}`)

    const data = await res.json() as {
      web?: { results?: Array<{ title: string; url: string; description: string }> }
    }

    const results: SearchResult[] = (data.web?.results ?? []).slice(0, 6).map(r => ({
      title: r.title,
      url: r.url,
      snippet: r.description ?? '',
    }))

    return NextResponse.json({ results, source: 'brave' })
  } catch {
    return NextResponse.json({ results: curatedLinks(query), source: 'curated' })
  }
}
