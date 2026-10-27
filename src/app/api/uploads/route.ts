import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApi } from '@/lib/auth/context'
import { AdminNotConfiguredError } from '@/lib/supabase/admin'
import { createStagedUpload, isOwnStagedPath, removeStaged, STAGED_MAX_BYTES } from '@/lib/staged-upload'

const bodySchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  size: z.number().int().min(1),
})

// A signed URL for uploading one document straight to Storage (see lib/staged-upload)
export async function POST(req: NextRequest) {
  const auth = await requireApi({ libraryEdit: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid upload request' }, { status: 400 })
  if (parsed.data.size > STAGED_MAX_BYTES) {
    return NextResponse.json({ error: 'File too large (max 20 MB)' }, { status: 413 })
  }

  try {
    return NextResponse.json(await createStagedUpload(ctx.account.id, parsed.data.fileName))
  } catch (err) {
    if (err instanceof AdminNotConfiguredError) {
      return NextResponse.json({ error: 'Document storage is not configured', code: 'storage_not_configured' }, { status: 503 })
    }
    console.error('staged upload sign failed', err)
    return NextResponse.json({ error: 'Could not start the upload' }, { status: 500 })
  }
}

// Discards a staged upload that won't be used (e.g. a dialog was closed before saving). Best effort.
export async function DELETE(req: NextRequest) {
  const auth = await requireApi({ libraryEdit: true })
  if (!auth.ok) return auth.res

  const parsed = z.object({ path: z.string().min(1).max(512) }).safeParse(await req.json().catch(() => null))
  if (!parsed.success || !isOwnStagedPath(auth.ctx.account.id, parsed.data.path)) {
    return NextResponse.json({ error: 'Upload not found' }, { status: 404 })
  }
  try {
    await removeStaged(parsed.data.path)
  } catch (err) {
    if (!(err instanceof AdminNotConfiguredError)) throw err
  }
  return new NextResponse(null, { status: 204 })
}
