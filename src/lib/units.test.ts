import { describe, expect, it } from 'vitest'
import { amountInTargetUnit, convertToUnit, parseUnit, targetValueInNutrientUnit, withUnit } from './units'
import { evaluateTargets } from './target-validation'
import type { NutrientResult } from './formulation-calc'
import type { ProjectTarget } from './types'
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

describe('% of 100g and % DV targets', () => {
  it('converts a share to and from the nutrient’s unit', () => {
    // 20% = 20 g per 100 g
    expect(targetValueInNutrientUnit(20, '%', 'g', 50)).toBe(20)
    expect(targetValueInNutrientUnit(0.5, '%', 'mg', null)).toBe(500)
    expect(amountInTargetUnit(500, 'mg', '%', null)).toBe(0.5)
    // 20% DV of calcium (DV 1,300 mg) = 260 mg
    expect(targetValueInNutrientUnit(20, '% DV', 'mg', 1300)).toBe(260)
    expect(amountInTargetUnit(260, 'mg', '% DV', 1300)).toBe(20)
  })

  it('can’t give energy as % of weight, or % DV without a Daily Value', () => {
    expect(targetValueInNutrientUnit(10, '%', 'kcal', 2000)).toBeNull()
    expect(amountInTargetUnit(5, 'g', '% DV', null)).toBeNull()
  })

  it('formats shares without a space', () => {
    expect(withUnit(20, '%')).toBe('20%')
    expect(withUnit(20, '% DV')).toBe('20% DV')
    expect(withUnit(20, 'mg')).toBe('20 mg')
  })

  it('solves % targets in the nutrient’s unit, with % of weight always per 100 g', () => {
    const { targets, unconvertible } = targetsInNutrientUnits(
      [
        { nutrient: 'Protein', value: 20, unit: '%', basis: 'per_serving' },
        { nutrient: 'Calcium', value: 10, valueMax: 20, unit: '% DV', basis: 'per_serving' },
        { nutrient: 'Fiber', value: 10, unit: '% DV', basis: 'per_serving' },
      ],
      t => t.nutrient,
      new Map([['Protein', 'g'], ['Calcium', 'mg'], ['Fiber', 'g']]),
      new Map([['Protein', 50], ['Calcium', 1300], ['Fiber', null]]),
    )
    expect(targets[0]).toMatchObject({ value: 20, unit: 'g', basis: 'per_100g' })
    expect(targets[1]).toMatchObject({ value: 130, valueMax: 260, unit: 'mg', basis: 'per_serving' })
    expect(unconvertible.map(t => t.nutrient)).toEqual(['Fiber'])
  })

  it('checks a formulation against % targets', () => {
    const results: NutrientResult[] = [
      { nutrientId: 'p', name: 'Protein', unit: 'g', category: 'macros', perFinished100g: 22, dailyValueAmount: 50 },
      { nutrientId: 'c', name: 'Calcium', unit: 'mg', category: 'minerals', perFinished100g: 400, dailyValueAmount: 1300 },
    ]
    const targets: ProjectTarget[] = [
      { nutrient: 'Protein', label: 'Protein', comparator: '>=', value: 20, unit: '%', basis: 'per_100g' },
      // 400 mg/100 g × 50 g serving = 200 mg = 15.4% DV
      { nutrient: 'Calcium', label: 'Calcium', comparator: '>=', value: 20, unit: '% DV', basis: 'per_serving' },
    ]
    const [protein, calcium] = evaluateTargets(targets, results, 50)
    expect(protein).toMatchObject({ status: 'pass', actual: 22 })
    expect(calcium.status).toBe('fail')
    expect(calcium.actual).toBeCloseTo(15.38, 2)
  })
})
