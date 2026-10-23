import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { resolvePreferences, userPreferencesSchema } from '@/lib/preferences'

// The signed-in user's display preferences. PATCH merges the given fields into what's stored.

export async function GET() {
  const auth = await requireApi({ allowUnentitled: true })
  if (!auth.ok) return auth.res
  return NextResponse.json(resolvePreferences(auth.ctx.profile?.preferences))
}

export async function PATCH(req: NextRequest) {
  const auth = await requireApi({ allowUnentitled: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const parsed = userPreferencesSchema.strict().safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid preferences' }, { status: 400 })
  }
  const preferences = { ...ctx.profile?.preferences, ...parsed.data }
  await db
    .insert(profiles)
    .values({ userId: ctx.user.id, preferences })
    .onConflictDoUpdate({ target: profiles.userId, set: { preferences, updatedAt: new Date() } })
  return NextResponse.json(resolvePreferences(preferences))
}
