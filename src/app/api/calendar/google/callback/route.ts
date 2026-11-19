import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getContext } from '@/lib/auth/context'
import { getAppOrigin } from '@/lib/app-url'
import { connectFromCode, isGoogleCalendarConfigured, STATE_COOKIE } from '@/lib/calendar/google'

// Google sends the person back here after the consent screen (see ../connect/route.ts)
export async function GET(req: NextRequest) {
  const origin = getAppOrigin(req.nextUrl.origin)
  const back = (q: string) => {
    const res = NextResponse.redirect(`${origin}/settings/calendar?${q}`)
    res.cookies.set(STATE_COOKIE, '', { path: '/api/calendar/google', maxAge: 0 })
    return res
  }

  // Also present for suspended or unsubscribed accounts, whose Settings still work
  const { ctx } = await getContext()
  if (!ctx) return NextResponse.redirect(`${origin}/login?next=/settings/calendar`)
  if (!isGoogleCalendarConfigured()) return back('error=not_configured')

  const params = req.nextUrl.searchParams
  if (params.get('error')) return back('error=denied') // e.g. access_denied: they clicked Cancel

  const [state, stateUser] = (req.cookies.get(STATE_COOKIE)?.value ?? '').split('.')
  const given = params.get('state') ?? ''
  const sameState = !!state && state.length === given.length && timingSafeEqual(Buffer.from(state), Buffer.from(given))
  if (!sameState || stateUser !== ctx.user.id) return back('error=expired')

  const code = params.get('code')
  if (!code) return back('error=failed')
  const done = await connectFromCode({ id: ctx.user.id, accountId: ctx.account.id }, code, origin)
  return done.ok ? back('connected=1') : back(`error=${done.error}`)
}
