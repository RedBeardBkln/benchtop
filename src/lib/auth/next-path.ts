/** A same-site path to go to after signing in; anything else (another site, "//evil.com") becomes /projects */
export function safeNextPath(next: string | null | undefined, fallback = '/projects'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback
  return next
}
