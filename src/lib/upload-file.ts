import { createClient } from '@/lib/supabase/client'
import { readErrorMessage } from '@/lib/utils'

export const UPLOAD_MAX_BYTES = 20 * 1024 * 1024 // 20 MB, matches lib/staged-upload

/**
 * Upload a file straight to Storage and return its staging path, which the API routes that take
 * documents accept in place of the file itself. Avoids the ~4.5 MB request limit on our server.
 */
export async function uploadStaged(file: File): Promise<string> {
  if (file.size > UPLOAD_MAX_BYTES) throw new Error('File too large (max 20 MB)')
  const r = await fetch('/api/uploads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: file.name, size: file.size }),
  })
  if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not start the upload'))
  const { path, token } = (await r.json()) as { path: string; token: string }
  const { error } = await createClient().storage.from('ingredient-docs')
    .uploadToSignedUrl(path, token, file, { contentType: file.type || 'application/octet-stream' })
  if (error) throw new Error(`Upload failed: ${error.message}`)
  return path
}

/** Throws away a staged upload that won't be used; failures are ignored */
export function discardStaged(path: string): void {
  fetch('/api/uploads', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
    keepalive: true,
  }).catch(() => {})
}
