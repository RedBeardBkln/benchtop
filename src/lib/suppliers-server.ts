import { NextResponse } from 'next/server'
import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { ingredients, ingredientSuppliers, suppliers } from '@/lib/db/schema'

// Server helpers for supplier records (DB access). Validation lives in supplier-schemas.ts.
//
// An ingredient belongs to a supplier two ways: a sourcing link (ingredient_suppliers, with pack
// size and cost) or its free-text Supplier field naming the supplier. Both count.

const nameKey = (s: string) => s.trim().toLowerCase()

export type SupplierIngredient = {
  id: string
  name: string
  brandName: string | null
  itemCode: string | null
  category: string | null
  // Null when the ingredient only names this supplier in its Supplier field
  link: {
    id: string
    packSize: string | null
    packUnit: string | null
    costPerUnit: string | null
    isPreferred: boolean
  } | null
}

export async function getSupplierIngredients(accountId: string, supplierId: string, supplierName: string): Promise<SupplierIngredient[]> {
  const cols = {
    id: ingredients.id,
    name: ingredients.name,
    brandName: ingredients.brandName,
    itemCode: ingredients.itemCode,
    category: ingredients.category,
  }
  const [linked, named] = await Promise.all([
    db
      .select({
        ...cols,
        linkId: ingredientSuppliers.id,
        packSize: ingredientSuppliers.packSize,
        packUnit: ingredientSuppliers.packUnit,
        costPerUnit: ingredientSuppliers.costPerUnit,
        isPreferred: ingredientSuppliers.isPreferred,
      })
      .from(ingredientSuppliers)
      .innerJoin(ingredients, eq(ingredientSuppliers.ingredientId, ingredients.id))
      .where(and(eq(ingredientSuppliers.supplierId, supplierId), eq(ingredients.accountId, accountId))),
    db
      .select(cols)
      .from(ingredients)
      .where(and(
        eq(ingredients.accountId, accountId),
        sql`lower(trim(${ingredients.supplierName})) = ${nameKey(supplierName)}`,
      )),
  ])

  const out = new Map<string, SupplierIngredient>()
  for (const r of linked) {
    // An ingredient linked more than once (e.g. two pack sizes) is listed once, preferring the preferred link
    if (out.get(r.id)?.link?.isPreferred) continue
    out.set(r.id, {
      id: r.id, name: r.name, brandName: r.brandName, itemCode: r.itemCode, category: r.category,
      link: { id: r.linkId, packSize: r.packSize, packUnit: r.packUnit, costPerUnit: r.costPerUnit, isPreferred: r.isPreferred },
    })
  }
  for (const r of named) if (!out.has(r.id)) out.set(r.id, { ...r, link: null })
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name))
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** Points ingredients whose Supplier field names `oldName` (case-insensitively) at `newName`. Returns how many changed. */
export async function renameSupplierOnIngredients(tx: Tx, accountId: string, oldName: string, newName: string): Promise<number> {
  const key = nameKey(oldName)
  if (!key) return 0
  const rows = await tx
    .update(ingredients)
    .set({ supplierName: newName.trim() })
    .where(and(
      eq(ingredients.accountId, accountId),
      sql`lower(trim(${ingredients.supplierName})) = ${key}`,
    ))
    .returning({ id: ingredients.id })
  return rows.length
}

/** How many distinct ingredients each of the account's suppliers has, by supplier id. */
export async function getSupplierIngredientCounts(accountId: string): Promise<Map<string, number>> {
  const [supplierRows, links, named] = await Promise.all([
    db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(eq(suppliers.accountId, accountId)),
    db
      .select({ supplierId: ingredientSuppliers.supplierId, ingredientId: ingredientSuppliers.ingredientId })
      .from(ingredientSuppliers)
      .innerJoin(ingredients, eq(ingredientSuppliers.ingredientId, ingredients.id))
      .where(eq(ingredients.accountId, accountId)),
    db
      .select({ id: ingredients.id, supplierName: ingredients.supplierName })
      .from(ingredients)
      .where(and(eq(ingredients.accountId, accountId), isNotNull(ingredients.supplierName))),
  ])

  const byName = new Map<string, string[]>()
  for (const r of named) {
    const k = nameKey(r.supplierName!)
    if (k) byName.set(k, [...(byName.get(k) ?? []), r.id])
  }
  const sets = new Map<string, Set<string>>()
  for (const s of supplierRows) sets.set(s.id, new Set(byName.get(nameKey(s.name)) ?? []))
  for (const l of links) sets.get(l.supplierId)?.add(l.ingredientId)
  return new Map([...sets].map(([id, set]) => [id, set.size]))
}

/** Another supplier in the account with this name (ignoring case and surrounding spaces), if any */
export async function findSupplierByName(accountId: string, name: string, excludeId?: string) {
  const [row] = await db
    .select({ id: suppliers.id, name: suppliers.name })
    .from(suppliers)
    .where(and(
      eq(suppliers.accountId, accountId),
      sql`lower(trim(${suppliers.name})) = lower(trim(${name}))`,
      excludeId ? sql`${suppliers.id} <> ${excludeId}` : undefined,
    ))
    .limit(1)
  return row ?? null
}

export function duplicateSupplierResponse(existing: { id: string; name: string }) {
  return NextResponse.json(
    { error: `A supplier called "${existing.name}" already exists`, code: 'duplicate_supplier', existing },
    { status: 409 },
  )
}
