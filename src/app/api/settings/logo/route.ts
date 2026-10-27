import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { AdminNotConfiguredError } from '@/lib/supabase/admin'
import { isAccountLogoPath, LOGO_MAX_BYTES, newLogoPath, sniffLogoType } from '@/lib/logo'
import { removeLogo, storeLogo } from '@/lib/logo-server'

// The signed-in user's own company logo (see lib/logo). The file comes as multipart form data
// under "file"; logos are small enough to post straight to the route.

const storageError = () => NextResponse.json({ error: 'File storage is not configured' }, { status: 503 })

export async function POST(req: NextRequest) {
  const auth = await requireApi({ allowUnentitled: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (file.size > LOGO_MAX_BYTES) return NextResponse.json({ error: 'The logo must be 2 MB or smaller' }, { status: 413 })
  const bytes = new Uint8Array(await file.arrayBuffer())
  const type = sniffLogoType(bytes)
  if (!type) return NextResponse.json({ error: 'Use a PNG, JPEG or WEBP image' }, { status: 422 })

  const path = newLogoPath(ctx.account.id, 'own', ctx.user.id, type)
  try {
    const error = await storeLogo(path, bytes, type)
    if (error) {
      console.error('[logo] upload failed:', error.message)
      return NextResponse.json({ error: 'Could not save the logo' }, { status: 502 })
    }
  } catch (err) {
    if (err instanceof AdminNotConfiguredError) return storageError()
    throw err
  }

  await db
    .insert(profiles)
    .values({ userId: ctx.user.id, logoPath: path })
    .onConflictDoUpdate({ target: profiles.userId, set: { logoPath: path, updatedAt: new Date() } })

  const previous = ctx.profile?.logoPath
  if (isAccountLogoPath(ctx.account.id, previous) && previous !== path) await removeLogo(previous)
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const auth = await requireApi({ allowUnentitled: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const previous = ctx.profile?.logoPath
  if (!previous) return NextResponse.json({ ok: true })
  await db.update(profiles).set({ logoPath: null, updatedAt: new Date() }).where(eq(profiles.userId, ctx.user.id))
  try {
    if (isAccountLogoPath(ctx.account.id, previous)) await removeLogo(previous)
  } catch (err) {
    if (!(err instanceof AdminNotConfiguredError)) throw err
  }
  return NextResponse.json({ ok: true })
}
