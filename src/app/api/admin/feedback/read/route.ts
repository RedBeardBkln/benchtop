import { NextResponse } from 'next/server'
import { isNull } from 'drizzle-orm'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { feedback } from '@/lib/db/schema'

// Platform admins: mark every unread submission read (called when the Feedback page is opened)
export async function POST() {
  const auth = await requireApi({ allowUnentitled: true, platformAdmin: true })
  if (!auth.ok) return auth.res

  const rows = await db.update(feedback).set({ readAt: new Date() }).where(isNull(feedback.readAt)).returning({ id: feedback.id })
  return NextResponse.json({ marked: rows.length })
}
