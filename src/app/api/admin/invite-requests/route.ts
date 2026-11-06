import { NextRequest, NextResponse } from 'next/server'
import { count, desc, eq } from 'drizzle-orm'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { inviteRequests } from '@/lib/db/schema'

// Platform admins: beta invitation requests from the public site, newest first.
// `?count=new` returns only how many are waiting (drives the nav badge).
export async function GET(req: NextRequest) {
  const auth = await requireApi({ allowUnentitled: true, platformAdmin: true })
  if (!auth.ok) return auth.res

  if (req.nextUrl.searchParams.get('count') === 'new') {
    const [{ n }] = await db.select({ n: count() }).from(inviteRequests).where(eq(inviteRequests.status, 'new'))
    return NextResponse.json({ count: n })
  }

  const rows = await db
    .select({
      id: inviteRequests.id,
      name: inviteRequests.name,
      email: inviteRequests.email,
      company: inviteRequests.company,
      role: inviteRequests.role,
      companyType: inviteRequests.companyType,
      teamSize: inviteRequests.teamSize,
      message: inviteRequests.message,
      referral: inviteRequests.referral,
      status: inviteRequests.status,
      createdAt: inviteRequests.createdAt,
      reviewedAt: inviteRequests.reviewedAt,
    })
    .from(inviteRequests)
    .orderBy(desc(inviteRequests.createdAt))
    .limit(500)
  return NextResponse.json(rows)
}
