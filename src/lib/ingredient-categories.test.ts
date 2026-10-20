import { describe, expect, it } from 'vitest'
import {
  categoryPath, onHandAlternatives, parseIntakeLine, parseIntakeLines, quantityToGrams,
  type CategorizedIngredient,
} from './ingredient-categories'

describe('parseIntakeLine', () => {
  it('keeps a plain name', () => {
    expect(parseIntakeLine('Tapioca Starch')).toEqual({ rawName: 'Tapioca Starch', quantity: null, quantityUnit: null })
  })
  it('splits a trailing quantity in several spellings', () => {
    expect(parseIntakeLine('Tapioca starch 2 kg')).toEqual({ rawName: 'Tapioca starch', quantity: 2, quantityUnit: 'kg' })
    expect(parseIntakeLine('Sunflower lecithin, 500g')).toEqual({ rawName: 'Sunflower lecithin', quantity: 500, quantityUnit: 'g' })
    expect(parseIntakeLine('- Xanthan gum (1.5 lbs)')).toEqual({ rawName: 'Xanthan gum', quantity: 1.5, quantityUnit: 'lb' })
    expect(parseIntakeLine('MCT oil 1 L')).toEqual({ rawName: 'MCT oil', quantity: 1, quantityUnit: 'L' })
  })
  it('leaves a number without a unit in the name', () => {
    expect(parseIntakeLine('Oat Fiber 90')).toEqual({ rawName: 'Oat Fiber 90', quantity: null, quantityUnit: null })
    expect(parseIntakeLine('Maltodextrin 10 DE')).toEqual({ rawName: 'Maltodextrin 10 DE', quantity: null, quantityUnit: null })
  })
  it('skips blank lines and strips list markers', () => {
    expect(parseIntakeLines('1. Inulin\n\n  \n• Allulose 3 lb\n')).toEqual([
      { rawName: 'Inulin', quantity: null, quantityUnit: null },
      { rawName: 'Allulose', quantity: 3, quantityUnit: 'lb' },
    ])
  })
})

describe('quantityToGrams', () => {
  it('converts mass units', () => {
    expect(quantityToGrams(2, 'kg')).toBe(2000)
    expect(quantityToGrams(1, 'lb')).toBeCloseTo(453.592, 3)
  })
  it('returns null for volumes and counts', () => {
    expect(quantityToGrams(1, 'L')).toBeNull()
    expect(quantityToGrams(3, 'each')).toBeNull()
  })
})

describe('categoryPath', () => {
  it('joins the non-empty levels', () => {
    expect(categoryPath({ category: 'Starches', subcategory: 'Tapioca', microCategory: 'Native' })).toBe('Starches › Tapioca › Native')
    expect(categoryPath({ category: 'Sweeteners', subcategory: null, microCategory: '' })).toBe('Sweeteners')
    expect(categoryPath({})).toBe('')
  })
})

describe('onHandAlternatives', () => {
  const ing = (id: string, category: string | null, subcategory: string | null, microCategory: string | null, onHand: boolean): CategorizedIngredient =>
    ({ id, name: id, category, subcategory, microCategory, onHand })
  const library = [
    ing('corn-native', 'Starches', 'Corn', 'Native', true),
    ing('tapioca-native', 'Starches', 'Tapioca', 'Native', true),
    ing('tapioca-pregel', 'Starches', 'Tapioca', 'Pregelatinized', true),
    ing('tapioca-off-shelf', 'Starches', 'Tapioca', 'Native', false),
    ing('sugar', 'Sweeteners', 'Sugars', null, true),
  ]

  it('ranks the closest on-hand match first and skips items not on hand', () => {
    const target = ing('target', 'Starches', 'tapioca', 'native', false)
    expect(onHandAlternatives(target, library).map(c => c.id)).toEqual(['tapioca-native', 'tapioca-pregel', 'corn-native'])
  })
  it('suggests nothing for an on-hand or uncategorized target', () => {
    expect(onHandAlternatives(ing('t', 'Starches', 'Tapioca', null, true), library)).toEqual([])
    expect(onHandAlternatives(ing('t', null, null, null, false), library)).toEqual([])
  })
})
