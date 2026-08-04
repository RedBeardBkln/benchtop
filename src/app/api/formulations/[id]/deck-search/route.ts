import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { FDC_BASE } from '@/lib/usda-import'
import { z } from 'zod'

type Ctx = { params: Promise<{ id: string }> }

const bodySchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    rawName: z.string(),
    searchQuery: z.string(),
  })),
})

const DATA_TYPE_RANK: Record<string, number> = {
  Foundation: 0,
  'SR Legacy': 1,
  'Survey (FNDDS)': 2,
  Branded: 3,
}

// FDC nutrient IDs to show as preview on USDA candidate cards
const PREVIEW_IDS: Record<number, { name: string; unit: string }> = {
  1008: { name: 'Energy',   unit: 'kcal' },
  1003: { name: 'Protein',  unit: 'g'    },
  1004: { name: 'Fat',      unit: 'g'    },
  1005: { name: 'Carbs',    unit: 'g'    },
}

export async function POST(req: NextRequest, { params: _params }: Ctx) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.USDA_FDC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'USDA_FDC_API_KEY not configured' }, { status: 500 })

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const results = await Promise.all(parsed.data.items.map(async (item) => {
    try {
      const searchRes = await fetch(`${FDC_BASE}/foods/search?api_key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: item.searchQuery || item.rawName,
          dataType: ['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded'],
          pageSize: 8,
          pageNumber: 1,
        }),
        cache: 'no-store',
      })

      if (!searchRes.ok) return { id: item.id, candidates: [] }

      const searchData = await searchRes.json()

      type FdcSearchFood = {
        fdcId: number; description: string; dataType: string
        brandOwner?: string; brandName?: string
        foodNutrients?: Array<{
          nutrientId?: number; nutrientName?: string
          unitName?: string; value?: number
        }>
      }

      const foods: FdcSearchFood[] = searchData.foods ?? []

      const sorted = foods
        .slice()
        .sort((a, b) => (DATA_TYPE_RANK[a.dataType] ?? 99) - (DATA_TYPE_RANK[b.dataType] ?? 99))
        .slice(0, 5)

      const candidates = sorted.map(food => {
        const keyNutrients: Array<{ name: string; amount: number; unit: string }> = []
        if (food.foodNutrients) {
          for (const fn of food.foodNutrients) {
            const preview = fn.nutrientId != null ? PREVIEW_IDS[fn.nutrientId] : undefined
            if (preview && fn.value != null) {
              keyNutrients.push({
                name: preview.name,
                amount: Math.round(fn.value * 10) / 10,
                unit: preview.unit,
              })
            }
          }
        }
        return {
          fdcId: food.fdcId,
          description: food.description,
          dataType: food.dataType,
          brandOwner: food.brandOwner ?? food.brandName,
          keyNutrients,
        }
      })

      return { id: item.id, candidates }
    } catch {
      return { id: item.id, candidates: [] }
    }
  }))

  return NextResponse.json({ results })
}
