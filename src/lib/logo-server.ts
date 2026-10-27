import { DOCS_BUCKET, ensureDocsBucket, getSupabaseAdmin } from '@/lib/supabase/admin'
import { removeFolder } from '@/lib/staged-upload'
import { brandingPrefix, type LogoType } from '@/lib/logo'

// Storage for company logos (rules in lib/logo). SERVER ONLY.

const storage = () => getSupabaseAdmin().storage.from(DOCS_BUCKET)

export async function storeLogo(path: string, bytes: Uint8Array, contentType: LogoType): Promise<{ message: string } | null> {
  const upload = () => storage().upload(path, bytes, { contentType, upsert: false })
  let { error } = await upload()
  if (error && /bucket not found/i.test(error.message)) {
    if (!(await ensureDocsBucket())) ({ error } = await upload())
  }
  return error
}

export async function copyLogo(from: string, to: string): Promise<{ message: string } | null> {
  const { error } = await storage().copy(from, to)
  return error
}

export async function readLogo(path: string): Promise<Buffer | null> {
  const { data, error } = await storage().download(path)
  if (error || !data) return null
  return Buffer.from(await data.arrayBuffer())
}

/** Best effort: a leftover file is harmless (nothing points at it) */
export async function removeLogo(path: string | null | undefined): Promise<void> {
  if (!path) return
  const { error } = await storage().remove([path])
  if (error) console.error('[logo] remove failed:', error.message)
}

/** Every logo file the account has (used when the account is deleted) */
export function clearBranding(accountId: string): Promise<void> {
  return removeFolder(brandingPrefix(accountId).slice(0, -1))
}
