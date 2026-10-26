import { describe, expect, it } from 'vitest'
import { WEIGHT_UNITS, effectiveUnit, formatGramsIn, formatInUnit, fromGrams, isAmountInput, toGrams } from './weight-units'

describe('weight units', () => {
  it('converts mass units to and from grams', () => {
    expect(toGrams(1, 'oz')).toBe(28.3495)
    expect(toGrams(1.5, 'lb')).toBe(680.3886)
    expect(toGrams(0.25, 'kg')).toBe(250)
    expect(toGrams(500, 'mg')).toBe(0.5)
    expect(fromGrams(453.59237, 'lb')).toBeCloseTo(1, 10)
    expect(formatInUnit(fromGrams(28.3495, 'oz')!, 'oz')).toBe('1')
  })

  it('converts volume units through the density', () => {
    // 1 cup of honey at 1.42 g/mL
    expect(toGrams(1, 'cup', 1.42)).toBe(335.9553)
    expect(fromGrams(100, 'mL', 1)).toBe(100)
    expect(formatInUnit(fromGrams(toGrams(2, 'tbsp', 0.92)!, 'tbsp', 0.92)!, 'tbsp')).toBe('2')
    expect(toGrams(1, 'mL', null)).toBeNull()
    expect(fromGrams(10, 'tsp', 0)).toBeNull()
  })

  it('shows a line in its own unit, else the column’s, falling back to grams without a density', () => {
    expect(effectiveUnit(null, 'oz', null)).toBe('oz')
    expect(effectiveUnit('kg', 'oz', null)).toBe('kg')
    expect(effectiveUnit(null, 'mL', null)).toBe('g')
    expect(effectiveUnit(null, 'mL', 1.03)).toBe('mL')
    expect(effectiveUnit('cup', 'g', null)).toBe('g')
  })

  it('formats totals, falling back to grams for volume', () => {
    expect(formatGramsIn(1000, 'kg')).toBe('1 kg')
    expect(formatGramsIn(1234.5, 'mL')).toBe('1234.5 g')
    expect(formatGramsIn(453.59237, 'lb')).toBe('1 lb')
  })

  it('accepts the unit’s decimal places while typing', () => {
    expect(isAmountInput('1.2345', 'g')).toBe(true)
    expect(isAmountInput('1.23456', 'g')).toBe(false)
    expect(isAmountInput('0.000125', 'kg')).toBe(true)
    expect(isAmountInput('12.', 'oz')).toBe(true)
    expect(isAmountInput('1.05', 'mg')).toBe(false)
  })

  it('reads back what was typed in every unit, after storing grams to 4 places', () => {
    for (const unit of WEIGHT_UNITS) {
      for (const typed of [1, 1.25, 3, 12.5, 0.75]) {
        if (!isAmountInput(String(typed), unit)) continue
        const density = 0.92
        expect(formatInUnit(fromGrams(toGrams(typed, unit, density)!, unit, density)!, unit), `${typed} ${unit}`).toBe(String(typed))
      }
    }
  })
})
