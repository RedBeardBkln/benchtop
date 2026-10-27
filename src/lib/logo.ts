// Company logos. Pure rules, no imports, so unit-testable (storage lives in lib/logo-server).
//
// Each user can upload their own logo (profiles.logo_path). An owner or admin can apply theirs to
// the whole team, which copies it to accounts.logo_path; while that's set it's used on everyone's
// documents instead of their own. Files sit in the private docs bucket under the account's
// _branding/ folder and are served by /api/branding/logo after an account check.

export const LOGO_MAX_BYTES = 2 * 1024 * 1024 // 2 MB

export type LogoType = 'image/png' | 'image/jpeg' | 'image/webp'

const EXTENSIONS: Record<LogoType, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

/** PNG, JPEG or WEBP from the file's first bytes (not its name or claimed type); null for anything else */
export function sniffLogoType(bytes: Uint8Array): LogoType | null {
  const at = (i: number, ...want: number[]) => want.every((b, j) => bytes[i + j] === b)
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png'
  if (at(0, 0xff, 0xd8, 0xff)) return 'image/jpeg'
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return 'image/webp'
  return null
}

export const brandingPrefix = (accountId: string) => `${accountId}/_branding/`

export type LogoScope = 'own' | 'team'

/** A new, unique Storage path for a logo; a replaced logo gets a new path so cached copies never go stale */
export function newLogoPath(accountId: string, scope: LogoScope, userId: string, type: LogoType, now = Date.now()): string {
  const owner = scope === 'team' ? 'team' : `user-${userId}`
  return `${brandingPrefix(accountId)}${owner}-${now}.${EXTENSIONS[type]}`
}

/** True when a stored path belongs to this account's branding folder (a path from another account is ignored) */
export function isAccountLogoPath(accountId: string, path: string | null | undefined): path is string {
  if (!path) return false
  const prefix = brandingPrefix(accountId)
  const name = path.slice(prefix.length)
  return path.startsWith(prefix) && name.length > 0 && !name.includes('/') && !name.includes('\\')
}

export function logoContentType(path: string): LogoType | null {
  const ext = path.split('.').pop()?.toLowerCase()
  const hit = (Object.keys(EXTENSIONS) as LogoType[]).find(t => EXTENSIONS[t] === ext)
  return hit ?? null
}

/** Browser URL for a stored logo. `v` changes with the file, so the image can be cached for good. */
export function logoUrl(scope: LogoScope, path: string): string {
  const v = path.split('/').pop()!.replace(/\.[^.]+$/, '')
  return `/api/branding/logo?scope=${scope}&v=${encodeURIComponent(v)}`
}

export type Branding = {
  // The logo to put on documents: the team logo when one is applied, otherwise the user's own
  logoUrl: string | null
  own: string | null
  team: string | null
}

export function resolveBranding(accountId: string, ownPath: string | null | undefined, teamPath: string | null | undefined): Branding {
  const own = isAccountLogoPath(accountId, ownPath) ? logoUrl('own', ownPath) : null
  const team = isAccountLogoPath(accountId, teamPath) ? logoUrl('team', teamPath) : null
  return { logoUrl: team ?? own, own, team }
}
