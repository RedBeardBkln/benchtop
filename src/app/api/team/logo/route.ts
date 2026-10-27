import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { accounts } from '@/lib/db/schema'
import { AdminNotConfiguredError } from '@/lib/supabase/admin'
import { isAccountLogoPath, logoContentType, newLogoPath } from '@/lib/logo'
import { copyLogo, removeLogo } from '@/lib/logo-server'

// The team logo (see lib/logo). Owners and admins only.
// POST applies the caller's own logo to everyone; DELETE stops using a team logo, so each member's
// own logo (if any) is used again.

const storageError = () => NextResponse.json({ error: 'File storage is not configured' }, { status: 503 })

export async function POST() {
  const auth = await requireApi({ allowUnentitled: true, teamAdmin: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const own = ctx.profile?.logoPath
  const type = own ? logoContentType(own) : null
  if (!isAccountLogoPath(ctx.account.id, own) || !type) {
    return NextResponse.json({ error: 'Upload your logo first' }, { status: 422 })
  }

  // A copy, so the team logo stays put if the admin later replaces or removes their own
  const path = newLogoPath(ctx.account.id, 'team', ctx.user.id, type)
  try {
    const error = await copyLogo(own, path)
    if (error) {
      console.error('[logo] team copy failed:', error.message)
      return NextResponse.json({ error: 'Could not apply the logo' }, { status: 502 })
    }
  } catch (err) {
    if (err instanceof AdminNotConfiguredError) return storageError()
    throw err
  }

  await db.update(accounts).set({ logoPath: path }).where(eq(accounts.id, ctx.account.id))
  const previous = ctx.account.logoPath
  if (isAccountLogoPath(ctx.account.id, previous)) await removeLogo(previous)
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const auth = await requireApi({ allowUnentitled: true, teamAdmin: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const previous = ctx.account.logoPath
  if (!previous) return NextResponse.json({ ok: true })
  await db.update(accounts).set({ logoPath: null }).where(eq(accounts.id, ctx.account.id))
  try {
    if (isAccountLogoPath(ctx.account.id, previous)) await removeLogo(previous)
  } catch (err) {
    if (!(err instanceof AdminNotConfiguredError)) throw err
  }
  return NextResponse.json({ ok: true })
}
