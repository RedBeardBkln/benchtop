import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq, inArray, lt, type SQL } from 'drizzle-orm'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { accounts, activityLog, adminActions, clients, formulations, ingredients, projects, suppliers } from '@/lib/db/schema'
import { describeActivity } from '@/lib/activity'
import { describeAdminAction } from '@/lib/admin-actions'
import { getAuthUsers } from '@/lib/admin-server'
import { isUuid } from '@/lib/tenancy'

// Records whose names are shown in the log, and where they open
const NAMED = {
  projects: { table: projects, href: (id: string) => `/projects/${id}` },
  formulations: { table: formulations, href: (id: string) => `/formulations/${id}` },
  ingredients: { table: ingredients, href: (id: string) => `/ingredients/${id}` },
  clients: { table: clients, href: (id: string) => `/clients/${id}` },
  suppliers: { table: suppliers, href: (id: string) => `/suppliers/${id}` },
} as const

// Platform admin: what people did in the app and what platform admins did to accounts, newest
// first. Filters: ?accountId, ?userId; page with ?before=<ISO time of the last item>.
export async function GET(req: NextRequest) {
  const auth = await requireApi({ allowUnentitled: true, platformAdmin: true })
  if (!auth.ok) return auth.res

  const sp = req.nextUrl.searchParams
  const accountId = sp.get('accountId')
  const userId = sp.get('userId')
  const before = sp.get('before')
  const limit = Math.min(Math.max(Number(sp.get('limit')) || 100, 1), 500)
  if ((accountId && !isUuid(accountId)) || (userId && !isUuid(userId))) {
    return NextResponse.json({ error: 'Invalid filter' }, { status: 400 })
  }
  const beforeDate = before && !Number.isNaN(Date.parse(before)) ? new Date(before) : null

  const userWhere: SQL[] = []
  const adminWhere: SQL[] = []
  if (accountId) {
    userWhere.push(eq(activityLog.accountId, accountId))
    adminWhere.push(eq(adminActions.accountId, accountId))
  }
  if (userId) {
    userWhere.push(eq(activityLog.userId, userId))
    adminWhere.push(eq(adminActions.targetUserId, userId))
  }
  if (beforeDate) {
    userWhere.push(lt(activityLog.at, beforeDate))
    adminWhere.push(lt(adminActions.at, beforeDate))
  }

  const [userRows, adminRows] = await Promise.all([
    db.select().from(activityLog).where(and(...userWhere)).orderBy(desc(activityLog.at)).limit(limit),
    db.select().from(adminActions).where(and(...adminWhere)).orderBy(desc(adminActions.at)).limit(limit),
  ])

  // Names for the people, accounts and records mentioned
  const userIds = [...new Set([...userRows.map(r => r.userId), ...adminRows.map(r => r.adminUserId)])]
  const accountIds = [...new Set([...userRows.map(r => r.accountId), ...adminRows.flatMap(r => (r.accountId ? [r.accountId] : []))])]
  const [people, accountRows, ...named] = await Promise.all([
    getAuthUsers(userIds),
    accountIds.length ? db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(inArray(accounts.id, accountIds)) : [],
    ...Object.entries(NAMED).map(async ([entity, { table }]) => {
      const ids = [...new Set(userRows.filter(r => r.entity === entity && r.entityId && isUuid(r.entityId)).map(r => r.entityId!))]
      if (!ids.length) return [entity, new Map<string, string>()] as const
      const rows = await db.select({ id: table.id, name: table.name }).from(table).where(inArray(table.id, ids))
      return [entity, new Map(rows.map(r => [r.id, r.name]))] as const
    }),
  ])
  const accountName = new Map(accountRows.map(a => [a.id, a.name]))
  const names = new Map(named)

  const items = [
    ...userRows.map(r => {
      const link = NAMED[r.entity as keyof typeof NAMED]
      const recordName = r.entityId ? names.get(r.entity)?.get(r.entityId) ?? null : null
      return {
        id: r.id,
        kind: 'user' as const,
        at: r.at.toISOString(),
        accountId: r.accountId,
        accountName: accountName.get(r.accountId) ?? null,
        userId: r.userId,
        email: people.get(r.userId)?.email ?? null,
        description: describeActivity(r.method, r.path),
        recordName,
        // Only records that still exist get a link
        href: link && recordName && r.entityId ? link.href(r.entityId) : null,
        path: `${r.method} ${r.path}`,
      }
    }),
    ...adminRows.map(r => ({
      id: r.id,
      kind: 'admin' as const,
      at: r.at.toISOString(),
      accountId: r.accountId,
      accountName: (r.accountId && accountName.get(r.accountId)) || (r.details.accountName as string | undefined) || null,
      userId: r.adminUserId,
      email: people.get(r.adminUserId)?.email ?? null,
      description: describeAdminAction(r.action, r.details),
      recordName: null,
      href: null,
      path: null,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit)

  return NextResponse.json({ items, nextBefore: items.length === limit ? items[items.length - 1].at : null })
}
