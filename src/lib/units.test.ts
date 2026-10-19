import { describe, expect, it } from 'vitest'
import { convertToUnit, parseUnit } from './units'
import { targetsInNutrientUnits } from './solver'

describe('convertToUnit', () => {
  it.each([
    [1, 'g', 'mg', 1_000],
    [1, 'g', 'mcg', 1_000_000],
    [1, 'mg', 'mcg', 1_000],
    [1_000_000, 'mcg', 'g', 1],
    [1_000, 'mcg', 'mg', 1],
    [2_500, 'mg', 'g', 2.5],
  ])('%s %s → %s %s', (v, from, to, out) => {
    expect(convertToUnit(v, from, to)).toBe(out)
  })

  it('reads µg, ug, and capitalized spellings', () => {
    expect(convertToUnit(1, 'G', 'µg')).toBeCloseTo(1e6)
    expect(convertToUnit(5, 'ug', 'mcg')).toBe(5)
    expect(convertToUnit(1, 'MG', 'μg')).toBeCloseTo(1e3)
    expect(convertToUnit(100, 'KCAL', 'kJ')).toBeCloseTo(418.4)
  })

  it('treats a bare unit as compatible with its qualified form', () => {
    expect(convertToUnit(1, 'mg', 'mcg RAE')).toBeCloseTo(1_000)
    expect(convertToUnit(900, 'mcg RAE', 'mcg')).toBe(900)
    expect(convertToUnit(16, 'mg NE', 'mg NE')).toBe(16)
  })

  it('refuses incompatible units', () => {
    expect(convertToUnit(1, 'IU', 'mcg')).toBeNull()
    expect(convertToUnit(1, 'g', 'kcal')).toBeNull()
    expect(convertToUnit(1, 'mcg RAE', 'mcg DFE')).toBeNull()
  })

  it('parses a qualified unit', () => {
    expect(parseUnit(' mcg DFE ')).toEqual({ base: 'mcg', qualifier: 'dfe' })
  })
})

describe('targetsInNutrientUnits', () => {
  const units = new Map([['Vitamin K', 'mcg'], ['Protein', 'g'], ['Vitamin D', 'mcg']])

  it('puts targets in the nutrient’s own unit', () => {
    const { targets, unconvertible } = targetsInNutrientUnits(
      [
        { name: 'Vitamin K', value: 0.1, valueMax: 0.2, unit: 'mg' },
        { name: 'Protein', value: 10, unit: 'g' },
      ],
      t => t.name,
      units,
    )
    expect(targets[0]).toMatchObject({ value: 100, valueMax: 200, unit: 'mcg' })
    expect(targets[1]).toMatchObject({ value: 10, unit: 'g' })
    expect(targets[1]).not.toHaveProperty('valueMax')
    expect(unconvertible).toEqual([])
  })

  it('sets aside targets whose unit can’t be converted', () => {
    const { targets, unconvertible } = targetsInNutrientUnits(
      [{ name: 'Vitamin D', value: 400, unit: 'IU' }],
      t => t.name,
      units,
    )
    expect(targets).toEqual([])
    expect(unconvertible).toHaveLength(1)
  })
})
