import { and, eq, isNull, lt, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { activityLog, adminActions, profiles } from '@/lib/db/schema'
import { LAST_SEEN_INTERVAL_MINUTES, parseActivityPath, shouldLogActivity } from './activity'

// Writes for the platform admin's activity log and last-seen times. Every call is best effort:
// a failure is logged and swallowed, never surfaced to the person using the app.

export async function recordActivity(input: { accountId: string; userId: string; method: string | null; path: string | null }) {
  const { accountId, userId, method, path } = input
  if (!shouldLogActivity(method, path)) return
  const { entity, entityId } = parseActivityPath(path!)
  try {
    await db.insert(activityLog).values({ accountId, userId, method: method!.toUpperCase(), path: path!.slice(0, 500), entity, entityId })
  } catch (err) {
    console.error('[activity] insert failed:', err)
  }
}

export async function touchLastSeen(userId: string) {
  try {
    await db
      .update(profiles)
      .set({ lastSeenAt: new Date() })
      .where(and(
        eq(profiles.userId, userId),
        or(
          isNull(profiles.lastSeenAt),
          lt(profiles.lastSeenAt, sql`now() - make_interval(mins => ${LAST_SEEN_INTERVAL_MINUTES})`),
        ),
      ))
  } catch (err) {
    console.error('[activity] last seen update failed:', err)
  }
}

export async function recordAdminAction(input: {
  adminUserId: string
  action: string
  accountId?: string | null
  targetUserId?: string | null
  details?: Record<string, unknown>
}) {
  try {
    await db.insert(adminActions).values({
      adminUserId: input.adminUserId,
      action: input.action,
      accountId: input.accountId ?? null,
      targetUserId: input.targetUserId ?? null,
      details: input.details ?? {},
    })
  } catch (err) {
    console.error('[admin] action log failed:', err)
  }
}
