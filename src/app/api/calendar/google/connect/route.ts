import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getContext } from '@/lib/auth/context'
import { getAppOrigin } from '@/lib/app-url'
import { authorizeUrl, isGoogleCalendarConfigured, STATE_COOKIE } from '@/lib/calendar/google'

// Starts connecting Google Calendar: a browser navigation from Settings → Calendar, sent on to
// Google's consent screen. The state ties Google's answer back to this browser and this person.
export async function GET(req: NextRequest) {
  const origin = getAppOrigin(req.nextUrl.origin)
  const result = await getContext()
  if (!result.ok && result.reason === 'unauthenticated') return NextResponse.redirect(`${origin}/login?next=/settings/calendar`)
  const ctx = result.ctx
  if (!ctx) return NextResponse.redirect(`${origin}/no-account`)
  if (!isGoogleCalendarConfigured()) return NextResponse.redirect(`${origin}/settings/calendar?error=not_configured`)

  const state = randomBytes(24).toString('base64url')
  const res = NextResponse.redirect(authorizeUrl(origin, state, ctx.user.email))
  res.cookies.set(STATE_COOKIE, `${state}.${ctx.user.id}`, {
    httpOnly: true,
    secure: origin.startsWith('https://'),
    sameSite: 'lax', // sent on Google's top-level redirect back
    path: '/api/calendar/google',
    maxAge: 600,
  })
  return res
}
