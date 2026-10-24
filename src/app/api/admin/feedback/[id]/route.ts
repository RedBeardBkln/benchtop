import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { feedback } from '@/lib/db/schema'

type Ctx = { params: Promise<{ id: string }> }

const patchSchema = z.object({ resolved: z.boolean() })

// Platform admins: mark a submission resolved, or reopen it
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi({ allowUnentitled: true, platformAdmin: true })
  if (!auth.ok) return auth.res

  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const [row] = await db
    .update(feedback)
    .set({ resolvedAt: parsed.data.resolved ? new Date() : null })
    .where(eq(feedback.id, id))
    .returning({ id: feedback.id, resolvedAt: feedback.resolvedAt })

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(row)
}
