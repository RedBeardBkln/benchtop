import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Refresh session — do NOT remove this call; it keeps the session alive
  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  // Login page: redirect authenticated users into the app
  const isLoginRoute = pathname.startsWith('/login')
  // Public routes: no auth required, but authenticated users are NOT ejected
  const isPublicRoute = pathname.startsWith('/forgot-password')
    || pathname.startsWith('/reset-password')
    || pathname.startsWith('/auth/confirm')
  const isPublicAsset = pathname.startsWith('/_next') || pathname.startsWith('/favicon')

  if (!user && !isLoginRoute && !isPublicRoute && !isPublicAsset) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (user && isLoginRoute) {
    const next = request.nextUrl.searchParams.get('next') ?? '/'
    const appUrl = request.nextUrl.clone()
    appUrl.pathname = next
    appUrl.search = ''
    return NextResponse.redirect(appUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Run on everything except static assets and Next.js internals
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
