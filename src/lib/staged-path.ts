// Pure path rules for staged uploads (see lib/staged-upload). No imports, so unit-testable.

export const stagingPrefix = (accountId: string) => `${accountId}/_staging/`

/** True for a path this account was given by createStagedUpload (paths come from the request body) */
export function isOwnStagedPath(accountId: string, path: string): boolean {
  const prefix = stagingPrefix(accountId)
  if (!path.startsWith(prefix)) return false
  const name = path.slice(prefix.length)
  return name.length > 0 && !name.includes('/') && !name.includes('\\') && name !== '.' && name !== '..'
}

/** The original file name, without the staging id */
export function stagedFileName(path: string): string {
  return path.split('/').pop()!.replace(/^[0-9a-f-]{36}-/, '')
}
