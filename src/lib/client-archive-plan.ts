// Which ingredients and suppliers may be archived along with a client. Pure, so it's shared by the
// archive dialog and the API (lib/client-archive.ts), which re-checks every choice.

export type ArchiveIngredient = {
  id: string
  name: string
  // Formulations (counted once per formulation, not per version) outside this client's projects that use it
  otherFormulations: number
}

export type ArchiveSupplier = {
  id: string
  name: string
  // The client's ingredients it supplies (sourcing link or Supplier field)
  clientIngredientIds: string[]
  // Active ingredients it supplies that aren't the client's
  otherIngredients: number
}

export type ClientArchivePlan = {
  projects: Array<{ id: string; name: string; status: string }>
  formulationCount: number
  ingredients: ArchiveIngredient[]
  suppliers: ArchiveSupplier[]
}

/** Why this ingredient can't be archived with the client, or null if it can. */
export function ingredientBlock(i: ArchiveIngredient): string | null {
  if (i.otherFormulations > 0) {
    return `Used in ${i.otherFormulations} formulation${i.otherFormulations === 1 ? '' : 's'} for other clients or projects`
  }
  return null
}

/** Why this supplier can't be archived, given the ingredients being archived, or null if it can. */
export function supplierBlock(s: ArchiveSupplier, ingredients: ArchiveIngredient[], selected: Set<string>): string | null {
  if (s.otherIngredients > 0) {
    return `Supplies ${s.otherIngredients} other ingredient${s.otherIngredients === 1 ? '' : 's'} in your library`
  }
  const kept = s.clientIngredientIds.filter(id => !selected.has(id))
  if (kept.length > 0) {
    const names = kept.map(id => ingredients.find(i => i.id === id)?.name ?? 'an ingredient')
    return `Supplies ${names.join(', ')}, which ${kept.length === 1 ? 'isn’t' : 'aren’t'} being archived`
  }
  return null
}

/** Checks a requested selection against the plan. Returns the first problem, or null. */
export function checkArchiveSelection(plan: ClientArchivePlan, ingredientIds: string[], supplierIds: string[]): string | null {
  const selected = new Set(ingredientIds)
  for (const id of ingredientIds) {
    const i = plan.ingredients.find(x => x.id === id)
    if (!i) return 'One of the chosen ingredients isn’t used by this client’s formulations.'
    const block = ingredientBlock(i)
    if (block) return `${i.name} can’t be archived: ${block.toLowerCase()}.`
  }
  for (const id of supplierIds) {
    const s = plan.suppliers.find(x => x.id === id)
    if (!s) return 'One of the chosen suppliers doesn’t supply this client’s ingredients.'
    const block = supplierBlock(s, plan.ingredients, selected)
    if (block) return `${s.name} can’t be archived: ${block.charAt(0).toLowerCase()}${block.slice(1)}.`
  }
  return null
}
