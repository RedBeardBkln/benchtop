import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { AdminNotConfiguredError } from '@/lib/supabase/admin'
import { isAccountLogoPath, logoContentType } from '@/lib/logo'
import { readLogo } from '@/lib/logo-server'

// The image itself, for <img> tags on documents and in settings. ?scope=own|team; the v parameter
// only busts caches (each replaced logo gets a new path, see lib/logo).
export async function GET(req: NextRequest) {
  const auth = await requireApi({ allowUnentitled: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const scope = req.nextUrl.searchParams.get('scope')
  const path = scope === 'team' ? ctx.account.logoPath : scope === 'own' ? ctx.profile?.logoPath : null
  const type = path ? logoContentType(path) : null
  if (!isAccountLogoPath(ctx.account.id, path) || !type) {
    return NextResponse.json({ error: 'No logo' }, { status: 404 })
  }

  let bytes: Buffer | null
  try {
    bytes = await readLogo(path)
  } catch (err) {
    if (err instanceof AdminNotConfiguredError) return NextResponse.json({ error: 'Storage is not configured' }, { status: 503 })
    throw err
  }
  if (!bytes) return NextResponse.json({ error: 'No logo' }, { status: 404 })

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
