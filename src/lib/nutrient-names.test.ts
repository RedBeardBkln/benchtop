import { describe, expect, it } from 'vitest'
import { canonicalNutrientName } from './nutrient-names'

describe('canonicalNutrientName', () => {
  it('maps common variants to the library names', () => {
    expect(canonicalNutrientName('Sugars')).toBe('Total Sugars')
    expect(canonicalNutrientName(' sugar ')).toBe('Total Sugars')
    expect(canonicalNutrientName('Calories')).toBe('Energy')
    expect(canonicalNutrientName('Total Carbohydrates')).toBe('Total Carbohydrate')
  })
  it('passes other names through', () => {
    expect(canonicalNutrientName('Added Sugars')).toBe('Added Sugars')
    expect(canonicalNutrientName(' Vitamin D ')).toBe('Vitamin D')
  })
})
