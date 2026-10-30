import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { accountMembers, accounts, profiles } from '@/lib/db/schema'
import { adminSuspendSchema } from '@/lib/account-schemas'
import { recordAdminAction } from '@/lib/activity-server'
import { getAuthUsers } from '@/lib/admin-server'
import { syncSeats } from '@/lib/billing/seat-sync'
import { removeMember } from '@/lib/team-server'
import { isUuid, notFoundResponse } from '@/lib/tenancy'

type Ctx = { params: Promise<{ userId: string }> }

async function loadTarget(userId: string, me: string) {
  if (!isUuid(userId)) return { ok: false as const, res: notFoundResponse() }
  if (userId === me) {
    return { ok: false as const, res: NextResponse.json({ error: 'You can’t do this to yourself', code: 'self' }, { status: 403 }) }
  }
  const [member] = await db
    .select({ accountId: accountMembers.accountId, role: accountMembers.role, accountName: accounts.name })
    .from(accountMembers)
    .innerJoin(accounts, eq(accounts.id, accountMembers.accountId))
    .where(eq(accountMembers.userId, userId))
    .limit(1)
  const email = (await getAuthUsers([userId])).get(userId)?.email ?? null
  return { ok: true as const, member: member ?? null, email }
}

// Platform admin: suspend one person (they can't use the app; nothing is deleted) or restore them
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi({ allowUnentitled: true, platformAdmin: true })
  if (!auth.ok) return auth.res

  const { userId } = await params
  const target = await loadTarget(userId, auth.ctx.user.id)
  if (!target.ok) return target.res

  const parsed = adminSuspendSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const { suspended, reason } = parsed.data

  const suspendedAt = suspended ? new Date() : null
  // Someone who never opened the app has no profile yet
  await db
    .insert(profiles)
    .values({ userId, suspendedAt })
    .onConflictDoUpdate({ target: profiles.userId, set: { suspendedAt } })

  await recordAdminAction({
    adminUserId: auth.ctx.user.id,
    accountId: target.member?.accountId ?? null,
    targetUserId: userId,
    action: suspended ? 'user.suspend' : 'user.restore',
    details: { email: target.email, accountName: target.member?.accountName ?? null, reason: reason || null },
  })
  return NextResponse.json({ suspendedAt })
}

// Platform admin: remove a team member from their account and delete their login. Owners can't be
// removed this way: delete the account, or have ownership handed over first.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi({ allowUnentitled: true, platformAdmin: true })
  if (!auth.ok) return auth.res

  const { userId } = await params
  const target = await loadTarget(userId, auth.ctx.user.id)
  if (!target.ok) return target.res
  if (!target.member) return notFoundResponse('This person isn’t in an account')
  if (target.member.role === 'owner') {
    return NextResponse.json({ error: 'An account’s owner can’t be removed. Delete the account instead.', code: 'owner' }, { status: 409 })
  }

  const { loginRemoved } = await removeMember(target.member.accountId, userId)
  const seatSync = await syncSeats(target.member.accountId)
  await recordAdminAction({
    adminUserId: auth.ctx.user.id,
    accountId: target.member.accountId,
    targetUserId: userId,
    action: 'user.remove',
    details: { email: target.email, accountName: target.member.accountName, loginRemoved },
  })
  return NextResponse.json({ ok: true, loginRemoved, seatSync })
}
