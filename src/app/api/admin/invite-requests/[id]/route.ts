import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { inviteRequests } from '@/lib/db/schema'
import { INVITE_REQUEST_STATUSES } from '@/lib/invite-requests'

const patchSchema = z.object({ status: z.enum(INVITE_REQUEST_STATUSES) })

// Platform admins: mark a request declined, invited, or back to new
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApi({ allowUnentitled: true, platformAdmin: true })
  if (!auth.ok) return auth.res
  const { id } = await params

  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { status } = parsed.data
  const [row] = await db
    .update(inviteRequests)
    .set({ status, reviewedAt: status === 'new' ? null : new Date() })
    .where(eq(inviteRequests.id, id))
    .returning({ id: inviteRequests.id })
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(row)
}
