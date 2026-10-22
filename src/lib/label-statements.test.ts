import { describe, expect, it } from 'vitest'
import {
  allergenStatement, buildStatementItems, combineItems, ingredientStatement, isDescendingByWeight,
  moveItem, removeFromGroup, renameItem, renderStatement, separateGroup, sortByWeight, type LabelInfo,
} from './label-statements'

const info = new Map<string, LabelInfo>([
  ['flour', { labelName: 'Enriched Wheat Flour', allergens: ['Wheat', 'Gluten'], subIngredients: ['Wheat Flour', 'Niacin'] }],
  ['milk', { labelName: null, allergens: ['Milk'], subIngredients: [] }],
  ['sugar', { labelName: '  ', allergens: [], subIngredients: [] }],
  ['soy', { labelName: 'Soy Lecithin', allergens: ['soybeans', 'custom:Celery'], subIngredients: [] }],
])

describe('ingredientStatement', () => {
  it('orders by weight and prefers label names and sub-ingredient lists', () => {
    expect(ingredientStatement([
      { ingredientId: 'sugar', ingredientName: 'Cane Sugar', weightG: 20 },
      { ingredientId: 'flour', ingredientName: 'Flour AP 11.7%', weightG: 50 },
      { ingredientId: 'milk', ingredientName: 'Whole Milk', weightG: 30 },
      { ingredientId: 'unknown', ingredientName: 'Salt', weightG: 1 },
    ], info)).toBe('Enriched Wheat Flour (Wheat Flour, Niacin), Whole Milk, Cane Sugar, Salt')
  })

  it('skips empty lines and declares a repeated ingredient once, by its combined weight', () => {
    const items = buildStatementItems([
      { ingredientId: 'milk', ingredientName: 'Whole Milk', weightG: 10 },
      { ingredientId: 'sugar', ingredientName: 'Cane Sugar', weightG: 15 },
      { ingredientId: 'milk', ingredientName: 'Whole Milk', weightG: 10 },
      { ingredientId: 'soy', ingredientName: 'Lecithin', weightG: 0 },
    ], info)
    expect(renderStatement(items)).toBe('Whole Milk, Cane Sugar')
    expect(items[0].weightG).toBe(20)
  })
})

describe('arranging the statement', () => {
  const items = buildStatementItems([
    { ingredientId: 'flour', ingredientName: 'Flour', weightG: 50 },
    { ingredientId: 'water', ingredientName: 'Water', weightG: 30 },
    { ingredientId: 'almonds', ingredientName: 'Almonds', weightG: 10 },
    { ingredientId: 'salt', ingredientName: 'Salt', weightG: 1 },
  ], info)

  it('moves an entry with its parenthetical attached', () => {
    const moved = moveItem(items, 'flour', 'almonds', 'after')
    expect(renderStatement(moved)).toBe('Water, Almonds, Enriched Wheat Flour (Wheat Flour, Niacin), Salt')
    expect(isDescendingByWeight(moved)).toBe(false)
    expect(renderStatement(sortByWeight(moved))).toBe(renderStatement(items))
    expect(renderStatement(moveItem(items, 'salt', 'flour', 'before'))).toMatch(/^Salt, Enriched/)
  })

  it('combines two entries into a named group in the target position, heaviest child first', () => {
    const combined = combineItems(items, 'almonds', 'water', 'g1', 'Water')
    const named = renameItem(combined, 'g1', 'Almond Milk')
    expect(renderStatement(named)).toBe('Enriched Wheat Flour (Wheat Flour, Niacin), Almond Milk (Water, Almonds), Salt')
    expect(named[1].weightG).toBe(40)
  })

  it('adds to an existing group, nesting a parenthetical ingredient intact', () => {
    const grouped = combineItems(combineItems(items, 'almonds', 'water', 'g1', 'Almond Milk'), 'flour', 'g1', 'g2', '')
    expect(renderStatement(grouped)).toBe('Almond Milk (Enriched Wheat Flour (Wheat Flour, Niacin), Water, Almonds), Salt')
  })

  it('takes entries back out of a group', () => {
    const grouped = combineItems(combineItems(items, 'almonds', 'water', 'g1', 'Mix'), 'salt', 'g1', 'g2', '')
    expect(renderStatement(removeFromGroup(grouped, 'g1', 'salt'))).toBe(
      'Enriched Wheat Flour (Wheat Flour, Niacin), Mix (Water, Almonds), Salt',
    )
    // A group left with one entry dissolves
    expect(renderStatement(removeFromGroup(removeFromGroup(grouped, 'g1', 'salt'), 'g1', 'almonds'))).toBe(
      'Enriched Wheat Flour (Wheat Flour, Niacin), Water, Almonds, Salt',
    )
    expect(renderStatement(separateGroup(grouped, 'g1'))).toBe(
      'Enriched Wheat Flour (Wheat Flour, Niacin), Water, Almonds, Salt',
    )
  })

  it('renames an entry inside a group', () => {
    const grouped = combineItems(items, 'almonds', 'water', 'g1', 'Almond Milk')
    expect(renderStatement(renameItem(grouped, 'almonds', 'almonds'))).toContain('Almond Milk (Water, almonds)')
  })
})

describe('allergenStatement', () => {
  it('combines every ingredient allergen once, alphabetically', () => {
    expect(allergenStatement([
      { ingredientId: 'flour', ingredientName: 'Flour', weightG: 50 },
      { ingredientId: 'milk', ingredientName: 'Milk', weightG: 30 },
      { ingredientId: 'soy', ingredientName: 'Lecithin', weightG: 1 },
      { ingredientId: 'milk', ingredientName: 'Milk', weightG: 2 },
    ], info)).toBe('Celery, Gluten, Milk, soybeans, Wheat.')
  })

  it('is empty without allergens and ignores unused lines', () => {
    expect(allergenStatement([{ ingredientId: 'sugar', ingredientName: 'Sugar', weightG: 5 }], info)).toBe('')
    expect(allergenStatement([{ ingredientId: 'milk', ingredientName: 'Milk', weightG: 0 }], info)).toBe('')
  })
})
