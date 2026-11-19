import { type NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { accountMembers } from '@/lib/db/schema'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin, isAdminConfigured } from '@/lib/supabase/admin'
import { safeNextPath } from '@/lib/auth/next-path'

// Where Supabase sends people back after "Continue with Google" on the login page.
//
// Access is by invitation only, but Supabase makes a login for any Google account it hasn't seen.
// So a Google sign-in counts only for someone who already has a Benchtop account (Supabase links
// it to their existing login when the Google address matches the one they were invited with). A
// login made just now for a stranger is deleted again, and they're told to use their invitation.
const NEW_LOGIN_WINDOW_MS = 10 * 60 * 1000

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const next = safeNextPath(searchParams.get('next'))
  const fail = (error: string) => NextResponse.redirect(`${origin}/login?error=${error}`)

  const code = searchParams.get('code')
  if (!code) return fail(searchParams.get('error') === 'access_denied' ? 'google-canceled' : 'google-failed')

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.user) {
    console.error('[auth callback] code exchange failed:', error?.message)
    return fail('google-failed')
  }

  const user = data.user
  const [member] = await db
    .select({ accountId: accountMembers.accountId })
    .from(accountMembers)
    .where(eq(accountMembers.userId, user.id))
    .limit(1)
  if (member) return NextResponse.redirect(`${origin}${next}`)

  await supabase.auth.signOut()
  const justMade = Date.now() - new Date(user.created_at).getTime() < NEW_LOGIN_WINDOW_MS
  const onlyGoogle = (user.identities ?? []).every(i => i.provider === 'google')
  if (justMade && onlyGoogle && isAdminConfigured()) {
    const { error: delErr } = await getSupabaseAdmin().auth.admin.deleteUser(user.id)
    if (delErr) console.error('[auth callback] removing uninvited Google login failed:', delErr.message)
  }
  return fail('google-no-account')
}
