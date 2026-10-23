import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { PRIVACY_VERSION, TERMS_VERSION } from '@/lib/legal'

const acceptSchema = z.object({
  accept: z.literal(true),
  // The versions the user was shown; a stale page can't accept text it never displayed
  termsVersion: z.literal(TERMS_VERSION),
  privacyVersion: z.literal(PRIVACY_VERSION),
})

// Records that the signed-in user accepted the current Terms and Privacy Policy. Works without a
// subscription and before acceptance, since every other route requires it first.
export async function POST(req: NextRequest) {
  const auth = await requireApi({ allowUnentitled: true, allowWithoutTerms: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const parsed = acceptSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'The Terms or Privacy Policy changed while this page was open. Reload and try again.', code: 'version_mismatch' },
      { status: 400 },
    )
  }

  const now = new Date()
  const accepted = {
    termsVersion: TERMS_VERSION,
    termsAcceptedAt: now,
    privacyVersion: PRIVACY_VERSION,
    privacyAcceptedAt: now,
    updatedAt: now,
  }
  await db
    .insert(profiles)
    .values({ userId: ctx.user.id, ...accepted })
    .onConflictDoUpdate({ target: profiles.userId, set: accepted })

  return NextResponse.json({ ok: true })
}
