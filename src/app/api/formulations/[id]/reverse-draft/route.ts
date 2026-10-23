import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { reverseWizardDrafts } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getOwnedFormulation, loadFormulationForEdit, notFoundResponse } from '@/lib/tenancy'

type Ctx = { params: Promise<{ id: string }> }

// The wizard's own state; it validates what it restores, so the server only checks shape and size
const MAX_DRAFT_BYTES = 2_000_000
const putSchema = z.object({ data: z.record(z.string(), z.unknown()) })

// The saved reverse-wizard draft for this formulation, or { draft: null }
export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { id } = await params

  try {
    if (!(await getOwnedFormulation(auth.ctx, id))) return notFoundResponse()
    const [row] = await db.select().from(reverseWizardDrafts).where(eq(reverseWizardDrafts.formulationId, id)).limit(1)
    return NextResponse.json({ draft: row?.data ?? null, savedAt: row?.updatedAt ?? null })
  } catch (err) {
    console.error('GET /api/formulations/[id]/reverse-draft error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// Save (replace) the draft
export async function PUT(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { id } = await params

  const text = await req.text()
  if (text.length > MAX_DRAFT_BYTES) return NextResponse.json({ error: 'Draft is too large to save' }, { status: 413 })
  let body: unknown
  try { body = JSON.parse(text) } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  try {
    const loaded = await loadFormulationForEdit(auth.ctx, id)
    if (!loaded.ok) return loaded.res
    const now = new Date()
    await db
      .insert(reverseWizardDrafts)
      .values({ formulationId: id, data: parsed.data.data, updatedAt: now })
      .onConflictDoUpdate({ target: reverseWizardDrafts.formulationId, set: { data: parsed.data.data, updatedAt: now } })
    return NextResponse.json({ savedAt: now })
  } catch (err) {
    console.error('PUT /api/formulations/[id]/reverse-draft error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// Discard the draft (also done once the wizard's result is applied)
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { id } = await params

  try {
    const loaded = await loadFormulationForEdit(auth.ctx, id)
    if (!loaded.ok) return loaded.res
    await db.delete(reverseWizardDrafts).where(eq(reverseWizardDrafts.formulationId, id))
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/formulations/[id]/reverse-draft error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
