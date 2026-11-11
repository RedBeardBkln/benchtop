// Pure, so it can be unit-tested without a database

/**
 * What went wrong, short enough to show and safe to keep: the first line only (a database error carries
 * the query and its parameters on later lines and after "params:"), without anything that looks like an
 * email address, at most 300 characters.
 */
export function errorSummary(e: unknown): string {
  const raw = e instanceof Error ? e.message : typeof e === 'string' ? e : 'Unknown error'
  return raw
    .split('\n')[0]
    .replace(/\bparams:.*$/i, '')
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '<email>')
    .trim()
    .slice(0, 300) || 'Unknown error'
}
