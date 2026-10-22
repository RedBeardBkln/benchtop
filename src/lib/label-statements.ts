// Default ingredient and allergen statements for a Nutrition Facts Panel — pure, fully testable

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

/**
 * One entry of the ingredient statement. A library ingredient keeps its own declared sub-ingredients
 * (`subs`) in parentheses wherever it moves; an entry with `children` is a group the user combined
 * on the panel, printed as "Name (child, child)".
 */
export type StatementItem = {
  id: string
  name: string
  weightG: number
  subs: string[]
  children: StatementItem[]
}

const byWeightDesc = (a: StatementItem, b: StatementItem) => b.weightG - a.weightG

/** One entry per ingredient in use, heaviest first, named by its label name when it has one. */
export function buildStatementItems(lines: StatementLine[], info: Map<string, LabelInfo>): StatementItem[] {
  const items = new Map<string, StatementItem>()
  for (const l of lines) {
    if (!(l.weightG > 0)) continue
    // The same ingredient on two lines is declared once, with their combined weight
    const existing = items.get(l.ingredientId)
    if (existing) { existing.weightG += l.weightG; continue }
    const i = info.get(l.ingredientId)
    items.set(l.ingredientId, {
      id: l.ingredientId,
      name: i?.labelName?.trim() || l.ingredientName,
      weightG: l.weightG,
      subs: i?.subIngredients ?? [],
      children: [],
    })
  }
  return [...items.values()].sort(byWeightDesc)
}

export function renderItem(item: StatementItem): string {
  const inner = item.children.length > 0 ? item.children.map(renderItem) : item.subs
  const name = item.name.trim()
  if (inner.length === 0) return name
  return name ? `${name} (${inner.join(', ')})` : `(${inner.join(', ')})`
}

export function renderStatement(items: StatementItem[]): string {
  return items.map(renderItem).filter(Boolean).join(', ')
}

/** Default statement text: heaviest first, label names, sub-ingredients in parentheses. */
export function ingredientStatement(lines: StatementLine[], info: Map<string, LabelInfo>): string {
  return renderStatement(buildStatementItems(lines, info))
}

export function isDescendingByWeight(items: StatementItem[]): boolean {
  return items.every((it, i) => i === 0 || it.weightG <= items[i - 1].weightG + 1e-9)
}

export function sortByWeight(items: StatementItem[]): StatementItem[] {
  return [...items].sort(byWeightDesc)
}

/** Move a top-level entry so it sits just before or after another. */
export function moveItem(
  items: StatementItem[], dragId: string, targetId: string, where: 'before' | 'after',
): StatementItem[] {
  if (dragId === targetId) return items
  const dragged = items.find(i => i.id === dragId)
  if (!dragged || !items.some(i => i.id === targetId)) return items
  const rest = items.filter(i => i.id !== dragId)
  const at = rest.findIndex(i => i.id === targetId) + (where === 'after' ? 1 : 0)
  return [...rest.slice(0, at), dragged, ...rest.slice(at)]
}

/**
 * Drop one top-level entry onto another. Onto a group it joins that group; onto a plain entry the two
 * become a new group named `groupName`, at the target's position. Children stay heaviest first.
 */
export function combineItems(
  items: StatementItem[], dragId: string, targetId: string, newId: string, groupName: string,
): StatementItem[] {
  if (dragId === targetId) return items
  const dragged = items.find(i => i.id === dragId)
  const target = items.find(i => i.id === targetId)
  if (!dragged || !target) return items
  const merged: StatementItem = target.children.length > 0
    ? { ...target, weightG: target.weightG + dragged.weightG, children: [...target.children, dragged].sort(byWeightDesc) }
    : {
        id: newId,
        name: groupName,
        weightG: target.weightG + dragged.weightG,
        subs: [],
        children: [target, dragged].sort(byWeightDesc),
      }
  return items.filter(i => i.id !== dragId).map(i => (i.id === targetId ? merged : i))
}

/** Break a group back into its entries, in its place. */
export function separateGroup(items: StatementItem[], groupId: string): StatementItem[] {
  return items.flatMap(i => (i.id === groupId && i.children.length > 0 ? i.children : [i]))
}

/** Take one entry out of a group and put it back in the list just after the group; a group left with one entry dissolves. */
export function removeFromGroup(items: StatementItem[], groupId: string, childId: string): StatementItem[] {
  return items.flatMap(i => {
    if (i.id !== groupId) return [i]
    const child = i.children.find(c => c.id === childId)
    if (!child) return [i]
    const remaining = i.children.filter(c => c.id !== childId)
    if (remaining.length <= 1) return [...remaining, child]
    return [{ ...i, weightG: i.weightG - child.weightG, children: remaining }, child]
  })
}

export function renameItem(items: StatementItem[], id: string, name: string): StatementItem[] {
  return items.map(i => {
    if (i.id === id) return { ...i, name }
    if (i.children.some(c => c.id === id)) return { ...i, children: renameItem(i.children, id, name) }
    return i
  })
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
