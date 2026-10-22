// Default ingredient and allergen statements for a Nutrition Facts Panel — pure, fully testable

import { deckEntry } from '@/lib/formulation-to-ingredient'

export type LabelInfo = {
  labelName: string | null
  allergens: string[]
  subIngredients: string[]
}

export type StatementLine = {
  ingredientId: string
  ingredientName: string
  weightG: number
}

/** Heaviest first, using each ingredient's label name and its own sub-ingredient list when it has them. */
export function ingredientStatement(lines: StatementLine[], info: Map<string, LabelInfo>): string {
  const entries = [...lines]
    .filter(l => l.weightG > 0)
    .sort((a, b) => b.weightG - a.weightG)
    .map(l => {
      const i = info.get(l.ingredientId)
      return deckEntry({
        ingredientName: l.ingredientName,
        labelName: i?.labelName ?? null,
        subIngredients: i?.subIngredients ?? [],
      })
    })
  // The same ingredient on two lines is declared once, at its first (heaviest) position
  const seen = new Set<string>()
  return entries.filter(e => {
    const k = e.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  }).join(', ')
}

/** "Contains: Milk, Soybeans." from every declared allergen of the ingredients in use; empty when none. */
export function allergenStatement(lines: StatementLine[], info: Map<string, LabelInfo>): string {
  const byKey = new Map<string, string>()
  for (const l of lines) {
    if (!(l.weightG > 0)) continue
    for (const raw of info.get(l.ingredientId)?.allergens ?? []) {
      const a = raw.replace(/^custom:/i, '').trim()
      if (a && !byKey.has(a.toLowerCase())) byKey.set(a.toLowerCase(), a)
    }
  }
  const all = [...byKey.values()].sort((a, b) => a.localeCompare(b))
  return all.length > 0 ? `Contains: ${all.join(', ')}.` : ''
}
