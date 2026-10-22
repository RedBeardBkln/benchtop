import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { requireApi, type AuthContext } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { accountMembers } from '@/lib/db/schema'
import { teamMemberUpdateSchema } from '@/lib/account-schemas'
import { syncSeats } from '@/lib/billing/seat-sync'
import { accessToStore, removeMember } from '@/lib/team-server'
import { isUuid, notFoundResponse } from '@/lib/tenancy'

type Ctx = { params: Promise<{ userId: string }> }

function forbidden(error: string) {
  return NextResponse.json({ error, code: 'forbidden' }, { status: 403 })
}

// The owner can't be changed or removed here, and nobody can change or remove themselves.
async function loadTarget(ctx: AuthContext, userId: string) {
  if (!isUuid(userId)) return { ok: false as const, res: notFoundResponse() }
  const [member] = await db
    .select({ userId: accountMembers.userId, role: accountMembers.role })
    .from(accountMembers)
    .where(and(eq(accountMembers.accountId, ctx.account.id), eq(accountMembers.userId, userId)))
    .limit(1)
  if (!member) return { ok: false as const, res: notFoundResponse() }
  if (member.role === 'owner') return { ok: false as const, res: forbidden('The account owner cannot be changed') }
  if (member.userId === ctx.user.id) {
    return { ok: false as const, res: forbidden('Ask another admin to change your own access') }
  }
  return { ok: true as const, member }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi({ allowUnentitled: true, teamAdmin: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { userId } = await params
  const target = await loadTarget(ctx, userId)
  if (!target.ok) return target.res

  const parsed = teamMemberUpdateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }
  const { role, access } = parsed.data

  const [row] = await db
    .update(accountMembers)
    .set({ role, access: await accessToStore(ctx.account.id, role, access) })
    .where(and(eq(accountMembers.accountId, ctx.account.id), eq(accountMembers.userId, userId)))
    .returning({ userId: accountMembers.userId, role: accountMembers.role, access: accountMembers.access })
  return NextResponse.json(row)
}

// Removes the member and their login, then lowers the billed seat count
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi({ allowUnentitled: true, teamAdmin: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { userId } = await params
  const target = await loadTarget(ctx, userId)
  if (!target.ok) return target.res

  const { loginRemoved } = await removeMember(ctx.account.id, userId)
  const seatSync = await syncSeats(ctx.account.id)
  return NextResponse.json({ ok: true, loginRemoved, seatSync })
}
