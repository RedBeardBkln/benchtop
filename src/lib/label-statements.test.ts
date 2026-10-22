import { describe, expect, it } from 'vitest'
import { allergenStatement, ingredientStatement, type LabelInfo } from './label-statements'

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

  it('skips empty lines and declares a repeated ingredient once', () => {
    expect(ingredientStatement([
      { ingredientId: 'milk', ingredientName: 'Whole Milk', weightG: 10 },
      { ingredientId: 'milk', ingredientName: 'Whole Milk', weightG: 5 },
      { ingredientId: 'sugar', ingredientName: 'Cane Sugar', weightG: 0 },
    ], info)).toBe('Whole Milk')
  })
})

describe('allergenStatement', () => {
  it('combines every ingredient allergen once, alphabetically', () => {
    expect(allergenStatement([
      { ingredientId: 'flour', ingredientName: 'Flour', weightG: 50 },
      { ingredientId: 'milk', ingredientName: 'Milk', weightG: 30 },
      { ingredientId: 'soy', ingredientName: 'Lecithin', weightG: 1 },
      { ingredientId: 'milk', ingredientName: 'Milk', weightG: 2 },
    ], info)).toBe('Contains: Celery, Gluten, Milk, soybeans, Wheat.')
  })

  it('is empty without allergens and ignores unused lines', () => {
    expect(allergenStatement([{ ingredientId: 'sugar', ingredientName: 'Sugar', weightG: 5 }], info)).toBe('')
    expect(allergenStatement([{ ingredientId: 'milk', ingredientName: 'Milk', weightG: 0 }], info)).toBe('')
  })
})
