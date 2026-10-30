// Pure rules for the platform admin's activity log (no DB access, so they're unit-testable and safe
// in middleware). Writing happens in lib/activity-server.ts.

// Middleware stamps every request with these, overwriting anything the browser sent, so route
// handlers can tell which call they're serving without being passed the request.
export const METHOD_HEADER = 'x-benchtop-method'
export const PATH_HEADER = 'x-benchtop-path'

const LOGGED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

// Platform admin calls are logged as admin actions instead; the rest only read or are noise
const SKIPPED_PREFIXES = ['/api/admin', '/api/stripe', '/api/billing/sync']

/** Whether a request is a change worth logging. */
export function shouldLogActivity(method: string | null, path: string | null): boolean {
  if (!method || !path || !LOGGED_METHODS.has(method.toUpperCase())) return false
  if (!path.startsWith('/api/')) return false
  return !SKIPPED_PREFIXES.some(p => path === p || path.startsWith(p + '/'))
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The area of the app and the record an API path is about, e.g. /api/formulations/<id>/lines. */
export function parseActivityPath(path: string): { entity: string; entityId: string | null; detail: string | null } {
  const parts = path.split('?')[0].split('/').filter(Boolean).slice(1) // drop 'api'
  const entity = parts[0] ?? 'unknown'
  const rest = parts.slice(1)
  const idAt = rest.findIndex(p => UUID_RE.test(p))
  const entityId = idAt === 0 ? rest[0] : null
  const detail = rest.filter(p => !UUID_RE.test(p)).join(' ').replace(/-/g, ' ') || null
  return { entity, entityId, detail }
}

const NOUNS: Record<string, string> = {
  account: 'account',
  billing: 'billing',
  branding: 'branding',
  clients: 'client',
  equipment: 'equipment',
  feedback: 'feedback',
  'formulation-imports': 'formulation import',
  formulations: 'formulation',
  ingredients: 'ingredient',
  intake: 'lab intake',
  invitations: 'invitation',
  legal: 'terms acceptance',
  nutrients: 'nutrient',
  projects: 'project',
  settings: 'settings',
  'sous-chef': 'Sous Chef',
  suppliers: 'supplier',
  team: 'team',
  'time-entries': 'time entry',
  uploads: 'upload',
  usda: 'USDA import',
}

const VERBS: Record<string, string> = { POST: 'Created', PUT: 'Updated', PATCH: 'Updated', DELETE: 'Deleted' }

/** A short human description, e.g. "Updated formulation", "Formulation: lines (updated)". */
export function describeActivity(method: string, path: string): string {
  const { entity, detail } = parseActivityPath(path)
  const noun = NOUNS[entity] ?? entity.replace(/-/g, ' ')
  const verb = VERBS[method.toUpperCase()] ?? method
  if (!detail) return `${verb} ${noun}`
  return `${noun.charAt(0).toUpperCase()}${noun.slice(1)}: ${detail} (${verb.toLowerCase()})`
}

// profiles.last_seen_at is written at most this often per person
export const LAST_SEEN_INTERVAL_MINUTES = 5
