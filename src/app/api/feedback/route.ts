import { NextRequest, NextResponse } from 'next/server'
import { and, count, eq, gt } from 'drizzle-orm'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { feedback } from '@/lib/db/schema'
import { feedbackSchema, isProfileComplete } from '@/lib/feedback'

// Bug reports and feature requests. Open to every signed-in member, subscribed or not, once their
// profile is complete (a full name), so there is someone to reply to.

const HOURLY_LIMIT = 20

// Whether the feedback link shows, and the contact details to pre-fill
export async function GET() {
  const auth = await requireApi({ allowUnentitled: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  return NextResponse.json({
    eligible: isProfileComplete(ctx.profile),
    contact: {
      name: ctx.profile?.fullName ?? '',
      email: ctx.user.email ?? '',
      phone: ctx.profile?.phone ?? '',
    },
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireApi({ allowUnentitled: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  if (!isProfileComplete(ctx.profile)) {
    return NextResponse.json(
      { error: 'Add your full name in Settings › Profile first', code: 'profile_incomplete' },
      { status: 403 },
    )
  }

  const parsed = feedbackSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request', fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const [{ n }] = await db
    .select({ n: count() })
    .from(feedback)
    .where(and(eq(feedback.userId, ctx.user.id), gt(feedback.createdAt, new Date(Date.now() - 60 * 60 * 1000))))
  if (n >= HOURLY_LIMIT) {
    return NextResponse.json({ error: 'Too many submissions. Please try again later.' }, { status: 429 })
  }

  const d = parsed.data
  const [row] = await db
    .insert(feedback)
    .values({
      accountId: ctx.account.id,
      userId: ctx.user.id,
      kind: d.kind,
      message: d.message,
      contactName: d.contactName,
      contactEmail: d.contactEmail,
      contactPhone: d.contactPhone,
      wantsContact: d.wantsContact,
      pagePath: d.pagePath ?? null,
      userAgent: req.headers.get('user-agent')?.slice(0, 500) ?? null,
    })
    .returning({ id: feedback.id })

  return NextResponse.json(row, { status: 201 })
}
