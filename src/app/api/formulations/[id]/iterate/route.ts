import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { formulations } from '@/lib/db/schema'
import { duplicateFormulation } from '@/lib/duplicate-formulation'
import { eq } from 'drizzle-orm'

type Ctx = { params: Promise<{ id: string }> }

// "New Iteration": copies this formulation as the next sequential version of the same formulation.
export async function POST(_req: NextRequest, { params }: Ctx) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const [source] = await db.select().from(formulations).where(eq(formulations.id, id)).limit(1)
  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const created = await duplicateFormulation(source, { kind: 'iteration' })
    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    // Unique (family_id, version) violation: two iterations were created at once
    console.error('POST /api/formulations/[id]/iterate error:', err)
    return NextResponse.json({ error: 'Could not create iteration — please try again' }, { status: 409 })
  }
}
