import { describe, expect, it } from 'vitest'
import { STANDARD_ALLERGENS, canonicalAllergen } from './allergens'

describe('canonicalAllergen', () => {
  it('maps the old soybean names to Soy', () => {
    for (const name of ['Soybeans', 'soybeans', ' Soybean ', 'SOY', 'Soya']) expect(canonicalAllergen(name)).toBe('Soy')
  })
  it('leaves other names as typed, trimmed', () => {
    expect(canonicalAllergen(' Celery ')).toBe('Celery')
    expect(canonicalAllergen('Soy Lecithin')).toBe('Soy Lecithin')
  })
  it('lists Soy, not Soybeans, as a standard allergen', () => {
    expect(STANDARD_ALLERGENS).toContain('Soy')
    expect(STANDARD_ALLERGENS).not.toContain('Soybeans')
  })
})
