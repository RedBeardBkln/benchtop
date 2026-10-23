import { NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { loadTaxonomyEntries } from '@/lib/ingredient-taxonomy'

// Category/subcategory/micro category combinations in use, for the edit forms' dropdowns
export async function GET() {
  const auth = await requireApi()
  if (!auth.ok) return auth.res

  try {
    return NextResponse.json(await loadTaxonomyEntries(auth.ctx.account.id))
  } catch (err) {
    console.error('GET /api/ingredients/taxonomy error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
