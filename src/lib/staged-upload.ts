import { randomUUID } from 'crypto'
import { DOCS_BUCKET, ensureDocsBucket, getSupabaseAdmin } from '@/lib/supabase/admin'
import { stagingPrefix } from '@/lib/staged-path'

export { isOwnStagedPath, stagedFileName } from '@/lib/staged-path'

// Large files go straight from the browser to Storage, because Vercel refuses request bodies over
// about 4.5 MB. The browser asks for a signed upload URL under the account's staging folder,
// uploads there, then hands the path to the route that uses the file. SERVER ONLY.

export const STAGED_MAX_BYTES = 20 * 1024 * 1024 // 20 MB


/** A signed URL the browser can upload one file to (valid for 2 hours) */
export async function createStagedUpload(accountId: string, fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'file'
  const path = `${stagingPrefix(accountId)}${randomUUID()}-${safeName}`
  const sign = () => getSupabaseAdmin().storage.from(DOCS_BUCKET).createSignedUploadUrl(path)
  let result = await sign()
  if (result.error && /bucket not found/i.test(result.error.message)) {
    if (!(await ensureDocsBucket())) result = await sign()
  }
  if (result.error) throw new Error(result.error.message)
  return { path, token: result.data.token }
}

export type StagedFile = { bytes: Buffer; contentType: string; size: number }

/** Download a staged file; null when it's missing or over the size limit (it's removed then) */
export async function readStaged(path: string): Promise<StagedFile | null> {
  const storage = getSupabaseAdmin().storage.from(DOCS_BUCKET)
  const { data, error } = await storage.download(path)
  if (error || !data) return null
  if (data.size > STAGED_MAX_BYTES) {
    await removeStaged(path)
    return null
  }
  return { bytes: Buffer.from(await data.arrayBuffer()), contentType: data.type, size: data.size }
}

/** Size of a staged file in bytes, or null when it isn't there */
export async function stagedSize(path: string): Promise<number | null> {
  const { data, error } = await getSupabaseAdmin().storage.from(DOCS_BUCKET).info(path)
  if (error || !data) return null
  return data.size ?? null
}

export async function moveStaged(from: string, to: string): Promise<{ message: string } | null> {
  const { error } = await getSupabaseAdmin().storage.from(DOCS_BUCKET).move(from, to)
  return error
}

export async function removeStaged(path: string): Promise<void> {
  await getSupabaseAdmin().storage.from(DOCS_BUCKET).remove([path])
}

/** Remove whatever is left in the account's staging folder (uploads that were never used) */
export async function clearStaging(accountId: string): Promise<void> {
  const storage = getSupabaseAdmin().storage.from(DOCS_BUCKET)
  const folder = stagingPrefix(accountId).slice(0, -1)
  for (;;) {
    const { data, error } = await storage.list(folder, { limit: 100 })
    if (error || !data || data.length === 0) return
    const { error: removeError } = await storage.remove(data.map(f => `${folder}/${f.name}`))
    if (removeError || data.length < 100) return
  }
}
