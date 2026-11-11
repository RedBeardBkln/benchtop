import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { accounts, dataExports } from '@/lib/db/schema'
import { getAuthUsers } from '@/lib/admin-server'
import { isUuid } from '@/lib/tenancy'

export type DataExportItem = {
  id: string
  at: string
  accountId: string
  accountName: string | null
  userId: string
  email: string | null
  kind: 'files' | 'json'
  status: 'started' | 'succeeded' | 'failed'
  choices: Record<string, string> | null
  summary: Record<string, number>
  bytes: number | null
  durationMs: number | null
  error: string | null
  downloadedAt: string | null
  finishedAt: string | null
}

// Platform admin: every account data export (Settings → Your data), newest first.
// Filters: ?accountId; page with ?before=<id of the last item> (keyset on time, then id, so none are skipped).
export async function GET(req: NextRequest) {
  const auth = await requireApi({ allowUnentitled: true, platformAdmin: true })
  if (!auth.ok) return auth.res

  const sp = req.nextUrl.searchParams
  const accountId = sp.get('accountId')
  const before = sp.get('before')
  const limit = Math.min(Math.max(Number(sp.get('limit')) || 100, 1), 500)
  if (accountId && !isUuid(accountId)) return NextResponse.json({ error: 'Invalid filter' }, { status: 400 })
  if (before && !isUuid(before)) return NextResponse.json({ error: 'Invalid page' }, { status: 400 })

  const where: SQL[] = []
  if (accountId) where.push(eq(dataExports.accountId, accountId))
  // Compared in the database at full (microsecond) precision
  if (before) where.push(sql`(${dataExports.at}, ${dataExports.id}) < (select d.at, d.id from data_exports d where d.id = ${before})`)
  const rows = await db.select().from(dataExports).where(and(...where)).orderBy(desc(dataExports.at), desc(dataExports.id)).limit(limit)

  const userIds = [...new Set(rows.map(r => r.userId))]
  const accountIds = [...new Set(rows.map(r => r.accountId))]
  const people = await getAuthUsers(userIds)
  const accountRows = accountIds.length
    ? await db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(inArray(accounts.id, accountIds))
    : []
  const accountName = new Map(accountRows.map(a => [a.id, a.name]))

  const items: DataExportItem[] = rows.map(r => ({
    id: r.id,
    at: r.at.toISOString(),
    accountId: r.accountId,
    accountName: accountName.get(r.accountId) ?? null,
    userId: r.userId,
    email: people.get(r.userId)?.email ?? null,
    kind: r.kind === 'json' ? 'json' : 'files',
    status: r.status === 'failed' ? 'failed' : r.status === 'started' ? 'started' : 'succeeded',
    choices: r.choices ?? null,
    summary: r.summary ?? {},
    bytes: r.bytes,
    durationMs: r.durationMs,
    error: r.error,
    downloadedAt: r.downloadedAt?.toISOString() ?? null,
    finishedAt: r.finishedAt?.toISOString() ?? null,
  }))
  return NextResponse.json({ items, nextBefore: items.length === limit ? items[items.length - 1].id : null })
}
