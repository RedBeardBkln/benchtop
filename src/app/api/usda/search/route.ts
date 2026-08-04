import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const FDC_BASE = 'https://api.nal.usda.gov/fdc/v1'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ foods: [], totalHits: 0, currentPage: 1, totalPages: 1 })

  const pageNumber = parseInt(request.nextUrl.searchParams.get('page') ?? '1', 10)

  const apiKey = process.env.USDA_FDC_API_KEY
  if (!apiKey) {
    console.error('USDA_FDC_API_KEY is not set in environment')
    return NextResponse.json({ error: 'USDA API key not configured on server' }, { status: 500 })
  }

  try {
    // Use POST /foods/search with JSON body — avoids URL-encoding issues with
    // array params and special characters in "Survey (FNDDS)"
    const res = await fetch(`${FDC_BASE}/foods/search?api_key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: q,
        dataType: ['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded'],
        pageNumber,
        pageSize: 25,
      }),
      cache: 'no-store',
    })

    if (!res.ok) {
      const body = await res.text()
      console.error(`USDA search HTTP ${res.status}:`, body.slice(0, 300))
      if (res.status === 429) {
        return NextResponse.json({ error: 'USDA rate limit reached — try again in a minute' }, { status: 429 })
      }
      return NextResponse.json({ error: `USDA returned ${res.status}: ${body.slice(0, 120)}` }, { status: 502 })
    }

    const data = await res.json()
    return NextResponse.json({
      foods: data.foods ?? [],
      totalHits: data.totalHits ?? 0,
      currentPage: data.currentPage ?? 1,
      totalPages: data.totalPages ?? 1,
    })
  } catch (err) {
    console.error('USDA search error:', err)
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }
}
