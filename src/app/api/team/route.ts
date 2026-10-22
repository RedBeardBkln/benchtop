import { NextResponse } from 'next/server'
import { and, asc, desc, eq, gt, isNull } from 'drizzle-orm'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { invitations, projects } from '@/lib/db/schema'
import { planInterval, seatBillingState } from '@/lib/billing/seat-sync'
import { listMembers } from '@/lib/team-server'
import { memberAccessSchema } from '@/lib/team-access'

// The team settings screen: members, pending invitations, the account's projects/clients (for the
// access editor) and seat billing. Owners and admins only.
export async function GET() {
  const auth = await requireApi({ allowUnentitled: true, teamAdmin: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const now = new Date()
  const [members, pending, projectRows] = await Promise.all([
    listMembers(ctx.account.id),
    db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.accountId, ctx.account.id),
          isNull(invitations.acceptedAt),
          isNull(invitations.revokedAt),
          gt(invitations.expiresAt, now),
        ),
      )
      .orderBy(desc(invitations.createdAt)),
    db
      .select({ id: projects.id, name: projects.name, client: projects.client })
      .from(projects)
      .where(eq(projects.accountId, ctx.account.id))
      .orderBy(asc(projects.name)),
  ])

  // Distinct client names, case-insensitively (first spelling wins)
  const clientsByKey = new Map<string, string>()
  for (const p of projectRows) {
    const name = p.client?.trim()
    if (name && !clientsByKey.has(name.toLowerCase())) clientsByKey.set(name.toLowerCase(), name)
  }
  const clients = [...clientsByKey.values()].sort((a, b) => a.localeCompare(b))

  const state = seatBillingState({ billingExempt: ctx.account.billingExempt, subscription: ctx.subscription })

  return NextResponse.json({
    me: ctx.user.id,
    members: members.map(m => {
      const access = memberAccessSchema.safeParse(m.access)
      return {
        userId: m.userId,
        email: m.email,
        fullName: m.fullName,
        role: m.role,
        access: m.role === 'member' && access.success ? access.data : null,
        createdAt: m.createdAt,
      }
    }),
    invitations: pending.map(i => {
      const access = memberAccessSchema.safeParse(i.access)
      return {
        id: i.id,
        email: i.email,
        role: i.role,
        access: access.success ? access.data : null,
        createdAt: i.createdAt,
        expiresAt: i.expiresAt,
      }
    }),
    projects: projectRows,
    clients,
    seats: {
      state,
      used: members.filter(m => m.role !== 'owner').length,
      billed: ctx.subscription?.seatQuantity ?? 0,
      interval: state === 'ready' ? await planInterval() : null,
    },
  })
}
