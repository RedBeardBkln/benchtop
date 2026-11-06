import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { and, count, eq, gt } from 'drizzle-orm'
import { db } from '@/lib/db'
import { inviteRequests } from '@/lib/db/schema'
import { inviteRequestSchema, isBotSubmission } from '@/lib/invite-requests'

// Beta invitation requests from the public site. Open to anyone (see middleware), so it is rate
// limited by IP, drops honeypot hits, and answers the same way whether or not the email has asked
// before, so it can't be used to find out who has.

const HOURLY_LIMIT_PER_IP = 5

function ipHash(req: NextRequest): string | null {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip')
  return ip ? createHash('sha256').update(`benchtop-invite:${ip}`).digest('hex') : null
}

export async function POST(req: NextRequest) {
  const parsed = inviteRequestSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request', fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }
  const d = parsed.data
  if (isBotSubmission(d)) return NextResponse.json({ ok: true }, { status: 201 })

  const hour = new Date(Date.now() - 60 * 60 * 1000)
  const ip = ipHash(req)
  if (ip) {
    const [{ n }] = await db
      .select({ n: count() })
      .from(inviteRequests)
      .where(and(eq(inviteRequests.ipHash, ip), gt(inviteRequests.createdAt, hour)))
    if (n >= HOURLY_LIMIT_PER_IP) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }
  }

  // One open request per email is enough; a repeat just looks like it worked
  const [open] = await db
    .select({ id: inviteRequests.id })
    .from(inviteRequests)
    .where(and(eq(inviteRequests.email, d.email), eq(inviteRequests.status, 'new')))
    .limit(1)
  if (open) return NextResponse.json({ ok: true }, { status: 201 })

  await db.insert(inviteRequests).values({
    name: d.name,
    email: d.email,
    company: d.company,
    role: d.role,
    companyType: d.companyType,
    teamSize: d.teamSize,
    message: d.message,
    referral: d.referral,
    ipHash: ip,
    userAgent: req.headers.get('user-agent')?.slice(0, 500) ?? null,
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}
