import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { formulations, formulationLines } from '@/lib/db/schema'
import { eq, max } from 'drizzle-orm'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Ctx) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const [source] = await db
    .select()
    .from(formulations)
    .where(eq(formulations.id, id))
    .limit(1)

  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Next version number = max version across all formulations in this project + 1
  const [{ maxVer }] = await db
    .select({ maxVer: max(formulations.version) })
    .from(formulations)
    .where(eq(formulations.projectId, source.projectId))

  const nextVersion = (maxVer ?? 0) + 1

  const [fork] = await db
    .insert(formulations)
    .values({
      projectId: source.projectId,
      name: source.name,
      version: nextVersion,
      parentFormulationId: source.id,
      mode: source.mode,
      status: 'draft',
      servingSizeG: source.servingSizeG,
      yieldPct: source.yieldPct,
      notes: source.notes,
    })
    .returning()

  const sourceLines = await db
    .select()
    .from(formulationLines)
    .where(eq(formulationLines.formulationId, id))

  if (sourceLines.length > 0) {
    await db.insert(formulationLines).values(
      sourceLines.map(l => ({
        formulationId: fork.id,
        ingredientId: l.ingredientId,
        position: l.position,
        weightG: l.weightG,
        pct: l.pct,
        minPct: l.minPct,
        maxPct: l.maxPct,
        locked: l.locked,
      }))
    )
  }

  return NextResponse.json(fork, { status: 201 })
}
