// What makes two ingredient-library entries "the same ingredient". Pure — shared by the API (to
// block saving a duplicate) and the UI (to flag existing ones).
//
// Two entries are duplicates when name, brand, supplier AND item code all match after
// normalising (case, extra whitespace, accents). Changing any one of them makes it a different
// entry, e.g. "Pea Protein" from two suppliers, or two brands of the same product.

export type IdentityFields = {
  name: string
  brandName?: string | null
  supplierName?: string | null
  itemCode?: string | null
}

export function normalizePart(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Stable key; identical keys mean duplicate entries. */
export function identityKey(f: IdentityFields): string {
  return JSON.stringify([
    normalizePart(f.name),
    normalizePart(f.brandName),
    normalizePart(f.supplierName),
    normalizePart(f.itemCode),
  ])
}

export const sameIdentity = (a: IdentityFields, b: IdentityFields) => identityKey(a) === identityKey(b)

/** Human description of the identity, for messages: "Pea Protein · Brand: X · Supplier: Y · Item #Z" */
export function describeIdentity(f: IdentityFields): string {
  const parts = [f.name.trim()]
  if (f.brandName?.trim()) parts.push(`Brand: ${f.brandName.trim()}`)
  if (f.supplierName?.trim()) parts.push(`Supplier: ${f.supplierName.trim()}`)
  if (f.itemCode?.trim()) parts.push(`Item #${f.itemCode.trim()}`)
  return parts.join(' · ')
}

/** Groups of 2+ entries sharing an identity. Order inside a group follows the input order. */
export function findDuplicateGroups<T extends IdentityFields & { id: string }>(rows: T[]): T[][] {
  const byKey = new Map<string, T[]>()
  for (const r of rows) {
    const k = identityKey(r)
    const g = byKey.get(k)
    if (g) g.push(r)
    else byKey.set(k, [r])
  }
  return [...byKey.values()].filter(g => g.length > 1)
}

/** id -> number of OTHER entries sharing its identity (only ids that have at least one). */
export function duplicateCounts<T extends IdentityFields & { id: string }>(rows: T[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const g of findDuplicateGroups(rows)) for (const r of g) out.set(r.id, g.length - 1)
  return out
}

export const DUPLICATE_CODE = 'duplicate_ingredient'

export function duplicateMessage(f: IdentityFields): string {
  return (
    `An ingredient with the same name, brand, supplier and item code already exists (${describeIdentity(f)}). ` +
    'Change the name, brand, supplier or item code so it is different, or use the existing ingredient.'
  )
}
