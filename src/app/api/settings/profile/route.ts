import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { profileSchema } from '@/lib/account-schemas'

// Settings must stay reachable for signed-in members who have no active subscription.

export async function GET() {
  const auth = await requireApi({ allowUnentitled: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  return NextResponse.json({
    email: ctx.user.email ?? null,
    fullName: ctx.profile?.fullName ?? null,
    company: ctx.profile?.company ?? null,
    jobTitle: ctx.profile?.jobTitle ?? null,
    phone: ctx.profile?.phone ?? null,
    timezone: ctx.profile?.timezone ?? null,
  })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireApi({ allowUnentitled: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const parsed = profileSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request', fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }
  const d = parsed.data
  const values = {
    fullName: d.fullName,
    company: d.company,
    jobTitle: d.jobTitle,
    phone: d.phone,
    timezone: d.timezone,
    updatedAt: new Date(),
  }

  // Never touches is_platform_admin or the terms/privacy acceptance columns
  const [row] = await db
    .insert(profiles)
    .values({ userId: ctx.user.id, ...values })
    .onConflictDoUpdate({ target: profiles.userId, set: values })
    .returning({
      fullName: profiles.fullName,
      company: profiles.company,
      jobTitle: profiles.jobTitle,
      phone: profiles.phone,
      timezone: profiles.timezone,
    })

  return NextResponse.json({ email: ctx.user.email ?? null, ...row })
}
