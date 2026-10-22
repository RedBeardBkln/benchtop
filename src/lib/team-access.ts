import { z } from 'zod'

// Pure team-permission rules (no DB access) so they are unit-testable and usable in client code.
//
// Owners and admins see and edit everything. A 'member' sees only what their MemberAccess grants:
//   - library: the ingredient library, suppliers, equipment and lab intake (always at least view,
//     since formulations can't be read without their ingredients)
//   - allProjects: a baseline level for every project in the account
//   - clients: a level for every project whose `client` matches (case-insensitive)
//   - projects: a level for one specific project
// The effective level for a project is the highest of whatever applies.

export type MemberRole = 'owner' | 'admin' | 'member'
export type AccessLevel = 'none' | 'view' | 'edit'
export type GrantLevel = 'view' | 'edit'

export type MemberAccess = {
  library: GrantLevel
  allProjects: AccessLevel
  clients: Array<{ client: string; level: GrantLevel }>
  projects: Array<{ projectId: string; level: GrantLevel }>
}

// What a new member gets unless the inviter changes it: the library read-only, no projects
export const DEFAULT_MEMBER_ACCESS: MemberAccess = {
  library: 'view',
  allProjects: 'none',
  clients: [],
  projects: [],
}

export const MAX_GRANTS = 500

const grantLevel = z.enum(['view', 'edit'])

export const memberAccessSchema = z.object({
  library: grantLevel,
  allProjects: z.enum(['none', 'view', 'edit']),
  clients: z
    .array(z.object({ client: z.string().trim().min(1).max(255), level: grantLevel }))
    .max(MAX_GRANTS),
  projects: z.array(z.object({ projectId: z.string().uuid(), level: grantLevel })).max(MAX_GRANTS),
})

const RANK: Record<AccessLevel, number> = { none: 0, view: 1, edit: 2 }

export function maxLevel(a: AccessLevel, b: AccessLevel): AccessLevel {
  return RANK[a] >= RANK[b] ? a : b
}

export function atLeast(level: AccessLevel, need: GrantLevel): boolean {
  return RANK[level] >= RANK[need]
}

export function normalizeClient(client: string | null | undefined): string {
  return (client ?? '').trim().toLowerCase()
}

export function isTeamAdmin(role: MemberRole): boolean {
  return role === 'owner' || role === 'admin'
}

// null access = unrestricted (owners and admins)
export function projectAccess(
  access: MemberAccess | null | undefined,
  project: { id: string; client: string | null },
): AccessLevel {
  if (!access) return 'edit'
  let level: AccessLevel = access.allProjects
  const client = normalizeClient(project.client)
  if (client) {
    for (const g of access.clients) {
      if (normalizeClient(g.client) === client) level = maxLevel(level, g.level)
    }
  }
  for (const g of access.projects) {
    if (g.projectId === project.id) level = maxLevel(level, g.level)
  }
  return level
}

// May this member create a project for `client`? Needs edit on every project of that client
// (or on all projects), since the new project falls under exactly those grants.
export function canCreateProject(access: MemberAccess | null | undefined, client: string | null): boolean {
  return atLeast(projectAccess(access, { id: '', client }), 'edit')
}

// Whether the member could create a project at all (shows/hides the "New project" button)
export function canCreateAnyProject(access: MemberAccess | null | undefined): boolean {
  if (!access) return true
  return access.allProjects === 'edit' || access.clients.some(c => c.level === 'edit')
}

export function canEditLibrary(access: MemberAccess | null | undefined): boolean {
  return !access || access.library === 'edit'
}

// One-line summary for the team list, e.g. "All projects: view · 2 clients · 1 project · Library: edit"
export function summarizeAccess(access: MemberAccess): string {
  const parts: string[] = []
  if (access.allProjects !== 'none') parts.push(`All projects: ${access.allProjects}`)
  if (access.clients.length) parts.push(`${access.clients.length} client${access.clients.length === 1 ? '' : 's'}`)
  if (access.projects.length) parts.push(`${access.projects.length} project${access.projects.length === 1 ? '' : 's'}`)
  if (parts.length === 0) parts.push('No projects')
  parts.push(`Library: ${access.library}`)
  return parts.join(' · ')
}

// Stored access for a role: owners/admins are unrestricted, so nothing is stored for them
export function accessForRole(role: MemberRole, access: MemberAccess | null | undefined): MemberAccess | null {
  if (isTeamAdmin(role)) return null
  return access ?? DEFAULT_MEMBER_ACCESS
}

/** Point client grants for `from` at the renamed client `to`; null when nothing changed. */
export function renameClientGrants(access: MemberAccess, from: string, to: string): MemberAccess | null {
  const key = normalizeClient(from)
  if (!access.clients.some(c => normalizeClient(c.client) === key)) return null
  return { ...access, clients: access.clients.map(c => (normalizeClient(c.client) === key ? { ...c, client: to } : c)) }
}
