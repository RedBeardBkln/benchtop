import { getSupabaseAdmin } from '@/lib/supabase/admin'

// Where finished export zips wait for the browser to download them: a private bucket only the server can
// reach, one folder per account (see app/api/account/export).
export const EXPORT_BUCKET = 'account-exports'

const PAGE = 1000

/**
 * Remove an account's staged exports: all of them (account deletion), or only those older than `olderThan`
 * (the sweep before each export, which never touches one still being downloaded). Lists page by page.
 */
export async function removeStagedExports(accountId: string, olderThan?: Date): Promise<void> {
  const storage = getSupabaseAdmin().storage.from(EXPORT_BUCKET)
  for (let offset = 0; ; offset += PAGE) {
    const { data: files, error } = await storage.list(accountId, { limit: PAGE, offset })
    if (error) {
      // No bucket yet means nothing was ever staged
      if (/not found/i.test(error.message)) return
      throw error
    }
    if (!files?.length) return
    const doomed = files.filter(f => !olderThan || (f.created_at && new Date(f.created_at) < olderThan))
    if (doomed.length) {
      const { error: removeError } = await storage.remove(doomed.map(f => `${accountId}/${f.name}`))
      if (removeError) throw removeError
      // Removed entries shift the listing, so the same offset shows the next ones
      offset -= doomed.length
    }
    if (files.length < PAGE) return
  }
}

/** Remove every staged export of an account (account deletion) */
export const clearStagedExports = (accountId: string) => removeStagedExports(accountId)
