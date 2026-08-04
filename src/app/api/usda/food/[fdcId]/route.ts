import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const FDC_BASE = 'https://api.nal.usda.gov/fdc/v1'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ fdcId: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { fdcId } = await params
  if (!/^\d+$/.test(fdcId)) {
    return NextResponse.json({ error: 'Invalid fdcId' }, { status: 400 })
  }

  try {
    const url = `${FDC_BASE}/food/${fdcId}?api_key=${process.env.USDA_FDC_API_KEY}`
    const res = await fetch(url, { next: { revalidate: 86400 } }) // cache 24 hr — USDA data is stable
    if (!res.ok) throw new Error(`FDC ${res.status}`)
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('USDA food fetch error:', err)
    return NextResponse.json({ error: 'USDA API unavailable' }, { status: 502 })
  }
}
