import { NextResponse } from 'next/server'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { equipment, formulations, ingredients, projects, suppliers } from '@/lib/db/schema'

// Ownership helpers. Every id that reaches a route (path param OR request body) must be proven to
// belong to the caller's account before it is used. A miss is reported as 404, never 403, so the
// existence of other accounts' rows is not leaked.

export type TenantScope = { account: { id: string } }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (s: unknown): s is string => typeof s === 'string' && UUID_RE.test(s)

export function notFoundResponse(message = 'Not found') {
  return NextResponse.json({ error: message }, { status: 404 })
}

export async function getOwnedProject(scope: TenantScope, id: string) {
  if (!isUuid(id)) return null
  const [row] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.accountId, scope.account.id)))
    .limit(1)
  return row ?? null
}

export async function getOwnedFormulation(scope: TenantScope, id: string) {
  if (!isUuid(id)) return null
  const [row] = await db
    .select()
    .from(formulations)
    .where(and(eq(formulations.id, id), eq(formulations.accountId, scope.account.id)))
    .limit(1)
  return row ?? null
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
