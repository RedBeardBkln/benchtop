import { NextResponse } from 'next/server'
import { count, isNull } from 'drizzle-orm'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { feedback } from '@/lib/db/schema'

// Platform admins: how many submissions nobody has looked at yet (drives the banner and nav badge)
export async function GET() {
  const auth = await requireApi({ allowUnentitled: true, platformAdmin: true })
  if (!auth.ok) return auth.res

  const [{ n }] = await db.select({ n: count() }).from(feedback).where(isNull(feedback.readAt))
  return NextResponse.json({ count: n })
}
