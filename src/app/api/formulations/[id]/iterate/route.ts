import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { loadFormulationForEdit } from '@/lib/tenancy'
import { duplicateFormulation } from '@/lib/duplicate-formulation'

type Ctx = { params: Promise<{ id: string }> }

// "New Iteration": copies this formulation as the next sequential version of the same formulation.
export async function POST(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  const loaded = await loadFormulationForEdit(ctx, id)
  if (!loaded.ok) return loaded.res
  const source = loaded.formulation

  try {
    const created = await duplicateFormulation(source, { kind: 'iteration' })
    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    // Unique (family_id, version) violation: two iterations were created at once
    console.error('POST /api/formulations/[id]/iterate error:', err)
    return NextResponse.json({ error: 'Could not create iteration — please try again' }, { status: 409 })
  }
}
