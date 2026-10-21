import { describe, expect, it } from 'vitest'
import { formatIngredientName } from './ingredient-name'

describe('formatIngredientName', () => {
  it('capitalizes the first letter of every word', () => {
    expect(formatIngredientName('tapioca starch, native')).toBe('Tapioca Starch, Native')
    expect(formatIngredientName('sunflower lecithin and water')).toBe('Sunflower Lecithin And Water')
  })

  it('tidies whitespace', () => {
    expect(formatIngredientName('  pea   protein  ')).toBe('Pea Protein')
  })

  it('capitalizes each part of hyphenated and bracketed words', () => {
    expect(formatIngredientName('all-purpose flour (unbleached)')).toBe('All-Purpose Flour (Unbleached)')
    expect(formatIngredientName('l-cysteine')).toBe('L-Cysteine')
    expect(formatIngredientName('non-gmo canola oil')).toBe('Non-GMO Canola Oil')
  })

  it("doesn't capitalize after an apostrophe", () => {
    expect(formatIngredientName("baker's yeast")).toBe("Baker's Yeast")
  })

  it('recases all-caps labels but keeps known abbreviations', () => {
    expect(formatIngredientName('TAPIOCA STARCH')).toBe('Tapioca Starch')
    expect(formatIngredientName('MCT OIL POWDER')).toBe('MCT Oil Powder')
    expect(formatIngredientName('MALTODEXTRIN 10 DE')).toBe('Maltodextrin 10 DE')
  })

  it('leaves words that already have capitals alone', () => {
    expect(formatIngredientName('citric acid, low pH grade')).toBe('Citric Acid, Low pH Grade')
    expect(formatIngredientName('DATEM')).toBe('DATEM')
    expect(formatIngredientName('mct oil')).toBe('MCT Oil')
  })

  it('handles vitamins, numbers and units', () => {
    expect(formatIngredientName('vitamin d3 100,000 iu/g')).toBe('Vitamin D3 100,000 IU/g')
    expect(formatIngredientName('vitamin b12 1% trituration')).toBe('Vitamin B12 1% Trituration')
    expect(formatIngredientName('whey protein isolate 90')).toBe('Whey Protein Isolate 90')
    expect(formatIngredientName('magnesium citrate 500 mg')).toBe('Magnesium Citrate 500 mg')
    expect(formatIngredientName('corn syrup 42de')).toBe('Corn Syrup 42de')
  })

  it('is idempotent', () => {
    for (const n of ['Tapioca Starch, Native', 'MCT Oil Powder', 'Citric Acid, Low pH Grade', 'Vitamin D3 100,000 IU/g']) {
      expect(formatIngredientName(formatIngredientName(n))).toBe(formatIngredientName(n))
    }
  })
})
