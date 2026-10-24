import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { formulationLines, ingredients } from '@/lib/db/schema'

// Completing a batch takes (saved line weight × multiplier) out of each tracked ingredient's
// stock. Shared by the preview and the real completion so they always agree.

export type BatchLine = { ingredientId: string; ingredientName: string; weightG: string; stockG: string | null }

export type Depletion = {
  ingredientId: string
  ingredientName: string
  depletedG: number
  /** Stock after the batch; null when the ingredient doesn't track stock */
  remainingG: number | null
}

export function computeDepletions(lines: BatchLine[], multiplier: number): Depletion[] {
  return lines.map(l => {
    const depletedG = parseFloat(l.weightG) * multiplier
    const remainingG = l.stockG != null ? parseFloat(l.stockG) - depletedG : null
    return { ingredientId: l.ingredientId, ingredientName: l.ingredientName, depletedG, remainingG }
  })
}

/** The formulation's saved lines with each ingredient's name and current stock */
export function loadBatchLines(accountId: string, formulationId: string): Promise<BatchLine[]> {
  return db
    .select({
      ingredientId: formulationLines.ingredientId,
      ingredientName: ingredients.name,
      weightG: formulationLines.weightG,
      stockG: ingredients.stockG,
    })
    .from(formulationLines)
    .innerJoin(ingredients, eq(formulationLines.ingredientId, ingredients.id))
    .where(and(eq(formulationLines.formulationId, formulationId), eq(ingredients.accountId, accountId)))
}
