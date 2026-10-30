import { NextResponse } from 'next/server'
import { asc, eq, isNull } from 'drizzle-orm'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { accountMembers, accounts, subscriptions } from '@/lib/db/schema'
import { asAccountPlan, hasFreeAccess } from '@/lib/billing/plans'
import { getAccountUsage } from '@/lib/admin-server'
import { getAuthEmails } from '@/lib/supabase/admin'

// Platform admin: every account with its plan, subscription, status and usage.
export async function GET() {
  const auth = await requireApi({ allowUnentitled: true, platformAdmin: true })
  if (!auth.ok) return auth.res

  const [rows, members, usage] = await Promise.all([
    db
      .select({ account: accounts, subscription: subscriptions })
      .from(accounts)
      .leftJoin(subscriptions, eq(subscriptions.accountId, accounts.id))
      .where(isNull(accounts.deletedAt))
      .orderBy(asc(accounts.name)),
    db.select({ accountId: accountMembers.accountId, userId: accountMembers.userId, role: accountMembers.role }).from(accountMembers),
    getAccountUsage(),
  ])

  const owners = new Map(members.filter(m => m.role === 'owner').map(m => [m.accountId, m.userId]))
  const emails = await getAuthEmails([...owners.values()])
  const now = new Date()

  return NextResponse.json(
    rows.map(({ account: a, subscription: s }) => ({
      id: a.id,
      name: a.name,
      ownerEmail: emails.get(owners.get(a.id) ?? '') ?? null,
      billingExempt: a.billingExempt,
      plan: asAccountPlan(a.plan),
      freeUntil: a.freeUntil,
      freeAccess: hasFreeAccess(a, now),
      maxUsers: a.maxUsers,
      additionalUsers: members.filter(m => m.accountId === a.id && m.role !== 'owner').length,
      subscriptionStatus: s?.status ?? null,
      cancelAtPeriodEnd: s?.cancelAtPeriodEnd ?? false,
      suspendedAt: a.suspendedAt,
      createdAt: a.createdAt,
      usage: usage.get(a.id) ?? null,
    })),
  )
}
