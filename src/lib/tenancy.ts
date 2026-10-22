import { NextResponse } from 'next/server'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { equipment, formulations, ingredients, projects, suppliers } from '@/lib/db/schema'
import { atLeast, projectAccess, type AccessLevel, type MemberAccess } from '@/lib/team-access'

// Ownership helpers. Every id that reaches a route (path param OR request body) must be proven to
// belong to the caller's account before it is used. A miss is reported as 404, never 403, so the
// existence of other accounts' rows is not leaked.
//
// Projects and formulations are additionally filtered by the caller's team access: a project the
// member has no access to is reported exactly like another account's (404). Handlers that CHANGE a
// project or formulation load it with loadProjectForEdit / loadFormulationForEdit, which answer
// 403 for view-only access.

// `access` null/absent = unrestricted (owners, admins)
export type TenantScope = { account: { id: string }; access?: MemberAccess | null }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (s: unknown): s is string => typeof s === 'string' && UUID_RE.test(s)

export function notFoundResponse(message = 'Not found') {
  return NextResponse.json({ error: message }, { status: 404 })
}

export function viewOnlyResponse() {
  return NextResponse.json({ error: 'You have view-only access to this project', code: 'view_only' }, { status: 403 })
}

export function projectLevel(scope: TenantScope, project: { id: string; client: string | null }): AccessLevel {
  return projectAccess(scope.access, project)
}

// Keeps only the projects the caller may see
export function visibleProjects<T extends { id: string; client: string | null }>(scope: TenantScope, rows: T[]): T[] {
  if (!scope.access) return rows
  return rows.filter(p => projectLevel(scope, p) !== 'none')
}

// The account's project ids the caller may see; null = all of them (unrestricted caller)
export async function visibleProjectIds(scope: TenantScope): Promise<Set<string> | null> {
  if (!scope.access) return null
  const rows = await db
    .select({ id: projects.id, client: projects.client })
    .from(projects)
    .where(eq(projects.accountId, scope.account.id))
  return new Set(visibleProjects(scope, rows).map(p => p.id))
}

export async function getOwnedProject(scope: TenantScope, id: string) {
  if (!isUuid(id)) return null
  const [row] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.accountId, scope.account.id)))
    .limit(1)
  if (!row || projectLevel(scope, row) === 'none') return null
  return row
}

async function formulationLevel(scope: TenantScope, projectId: string): Promise<AccessLevel> {
  if (!scope.access) return 'edit'
  const [project] = await db
    .select({ id: projects.id, client: projects.client })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.accountId, scope.account.id)))
    .limit(1)
  return project ? projectLevel(scope, project) : 'none'
}

export async function getOwnedFormulation(scope: TenantScope, id: string) {
  if (!isUuid(id)) return null
  const [row] = await db
    .select()
    .from(formulations)
    .where(and(eq(formulations.id, id), eq(formulations.accountId, scope.account.id)))
    .limit(1)
  if (!row || (await formulationLevel(scope, row.projectId)) === 'none') return null
  return row
}

// Whether the caller may change this formulation (its project grants edit)
export async function canEditFormulation(scope: TenantScope, formulation: { projectId: string }): Promise<boolean> {
  return atLeast(await formulationLevel(scope, formulation.projectId), 'edit')
}

type Loaded<K extends string, T> = ({ ok: true } & Record<K, T>) | { ok: false; res: NextResponse }

// For handlers that change a project: 404 when the caller can't see it, 403 when view-only
export async function loadProjectForEdit(
  scope: TenantScope,
  id: string,
): Promise<Loaded<'project', typeof projects.$inferSelect>> {
  const project = await getOwnedProject(scope, id)
  if (!project) return { ok: false, res: notFoundResponse() }
  if (!atLeast(projectLevel(scope, project), 'edit')) return { ok: false, res: viewOnlyResponse() }
  return { ok: true, project }
}

// For handlers that change a formulation: 404 when the caller can't see it, 403 when view-only
export async function loadFormulationForEdit(
  scope: TenantScope,
  id: string,
): Promise<Loaded<'formulation', typeof formulations.$inferSelect>> {
  if (!isUuid(id)) return { ok: false, res: notFoundResponse() }
  const [row] = await db
    .select()
    .from(formulations)
    .where(and(eq(formulations.id, id), eq(formulations.accountId, scope.account.id)))
    .limit(1)
  if (!row) return { ok: false, res: notFoundResponse() }
  const level = await formulationLevel(scope, row.projectId)
  if (level === 'none') return { ok: false, res: notFoundResponse() }
  if (level !== 'edit') return { ok: false, res: viewOnlyResponse() }
  return { ok: true, formulation: row }
}

export async function getOwnedIngredient(scope: TenantScope, id: string) {
  if (!isUuid(id)) return null
  const [row] = await db
    .select()
    .from(ingredients)
    .where(and(eq(ingredients.id, id), eq(ingredients.accountId, scope.account.id)))
    .limit(1)
  return row ?? null
}

export async function getOwnedSupplier(scope: TenantScope, id: string) {
  if (!isUuid(id)) return null
  const [row] = await db
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.id, id), eq(suppliers.accountId, scope.account.id)))
    .limit(1)
  return row ?? null
}

export async function getOwnedEquipment(scope: TenantScope, id: string) {
  if (!isUuid(id)) return null
  const [row] = await db
    .select()
    .from(equipment)
    .where(and(eq(equipment.id, id), eq(equipment.accountId, scope.account.id)))
    .limit(1)
  return row ?? null
}

// True only when EVERY id exists and belongs to the account (duplicates in `ids` are fine).
export async function assertIngredientsOwned(scope: TenantScope, ids: string[]): Promise<boolean> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return true
  if (!unique.every(isUuid)) return false
  const rows = await db
    .select({ id: ingredients.id })
    .from(ingredients)
    .where(and(inArray(ingredients.id, unique), eq(ingredients.accountId, scope.account.id)))
  return rows.length === unique.length
}

export async function assertSuppliersOwned(scope: TenantScope, ids: string[]): Promise<boolean> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return true
  if (!unique.every(isUuid)) return false
  const rows = await db
    .select({ id: suppliers.id })
    .from(suppliers)
    .where(and(inArray(suppliers.id, unique), eq(suppliers.accountId, scope.account.id)))
  return rows.length === unique.length
}

export async function assertEquipmentOwned(scope: TenantScope, ids: string[]): Promise<boolean> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return true
  if (!unique.every(isUuid)) return false
  const rows = await db
    .select({ id: equipment.id })
    .from(equipment)
    .where(and(inArray(equipment.id, unique), eq(equipment.accountId, scope.account.id)))
  return rows.length === unique.length
}
