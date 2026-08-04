import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { formulations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { reverseSolve } from '@/lib/solver'
import type { ReverseInput, SolverLine, NutrientTarget } from '@/lib/solver'
import { z } from 'zod'

type Ctx = { params: Promise<{ id: string }> }

const bodySchema = z.object({
  targetNutrients: z.array(z.object({
    name: z.string().min(1),
    value: z.number().min(0),
    unit: z.string().min(1),
  })),
  candidates: z.array(z.object({
    ingredientId: z.string().uuid(),
    minPct: z.number().min(0).max(100).default(0),
    maxPct: z.number().min(0).max(100).default(100),
    nutrients: z.array(z.object({
      name: z.string(),
      amountPer100g: z.number(),
    })),
  })),
  servingSizeG: z.number().positive().nullable().optional(),
})

export async function POST(req: NextRequest, { params }: Ctx) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const [formulation] = await db
    .select({ yieldPct: formulations.yieldPct, servingSizeG: formulations.servingSizeG })
    .from(formulations)
    .where(eq(formulations.id, id))
    .limit(1)

  if (!formulation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { targetNutrients, candidates, servingSizeG: bodyServingSizeG } = parsed.data

  const solverLines: SolverLine[] = candidates.map(c => ({
    key: c.ingredientId,
    ingredientName: c.ingredientId,
    weightG: 0,
    locked: false,
    minPct: c.minPct,
    maxPct: c.maxPct,
    nutrients: c.nutrients,
  }))

  // Prefer the label's serving size sent in the request body; fall back to the
  // formulation's own serving size if not provided.
  const servingSizeG =
    bodyServingSizeG ??
    (formulation.servingSizeG ? parseFloat(formulation.servingSizeG) : null)

  const input: ReverseInput = {
    candidates: solverLines,
    targetNutrients: targetNutrients as NutrientTarget[],
    yieldPct: parseFloat(formulation.yieldPct ?? '100'),
    servingSizeG,
  }

  return NextResponse.json(reverseSolve(input))
}
