import { NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { accounts, feedback } from '@/lib/db/schema'

// Platform admins: every feedback submission, newest first
export async function GET() {
  const auth = await requireApi({ allowUnentitled: true, platformAdmin: true })
  if (!auth.ok) return auth.res

  const rows = await db
    .select({ f: feedback, accountName: accounts.name })
    .from(feedback)
    .innerJoin(accounts, eq(feedback.accountId, accounts.id))
    .orderBy(desc(feedback.createdAt))
    .limit(500)

  return NextResponse.json(rows.map(r => ({ ...r.f, accountName: r.accountName })))
}
