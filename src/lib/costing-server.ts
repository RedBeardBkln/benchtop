import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { ingredients, ingredientSuppliers, suppliers } from '@/lib/db/schema'
import { resolveIngredientCost, type CostWarning, type IngredientCost } from '@/lib/costing'

export type IngredientCostInfo = { cost: IngredientCost | null; warning: CostWarning }

/** Each ingredient's cost for formulations, by id. Ids outside the account are left out. */
export async function getIngredientCosts(accountId: string, ids: string[]): Promise<Record<string, IngredientCostInfo>> {
  if (ids.length === 0) return {}
  const [rows, links] = await Promise.all([
    db.select({ id: ingredients.id, defaultCostPerKg: ingredients.defaultCostPerKg })
      .from(ingredients)
      .where(and(eq(ingredients.accountId, accountId), inArray(ingredients.id, ids))),
    db.select({
      id: ingredientSuppliers.id,
      ingredientId: ingredientSuppliers.ingredientId,
      supplierName: suppliers.name,
      packUnit: ingredientSuppliers.packUnit,
      costPerUnit: ingredientSuppliers.costPerUnit,
      useForCost: ingredientSuppliers.useForCost,
    })
      .from(ingredientSuppliers)
      .innerJoin(suppliers, eq(ingredientSuppliers.supplierId, suppliers.id))
      .where(and(inArray(ingredientSuppliers.ingredientId, ids), eq(ingredientSuppliers.useForCost, true), eq(suppliers.accountId, accountId))),
  ])
  const out: Record<string, IngredientCostInfo> = {}
  for (const r of rows) out[r.id] = resolveIngredientCost(r.defaultCostPerKg, links.filter(l => l.ingredientId === r.id))
  return out
}
