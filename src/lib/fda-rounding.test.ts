import { describe, expect, it } from 'vitest'
import {
  AMOUNT_RULES, declareAmount, declareDvPct, declareServings, declareServingSize, describeBands,
  roundToIncrement, ruleForNutrient,
} from './fda-rounding'

const amt = (name: string, v: number) => declareAmount(ruleForNutrient(name)!, v).text

describe('roundToIncrement', () => {
  it('rounds halves up and is float-safe', () => {
    expect(roundToIncrement(0.25, 0.5)).toBe(0.5)
    expect(roundToIncrement(2.5, 1)).toBe(3)
    expect(roundToIncrement(0.15, 0.1)).toBe(0.2)
    expect(roundToIncrement(0.1 + 0.2, 0.1)).toBe(0.3)
  })
})

describe('calories (c)(1)', () => {
  it.each([
    [0, '0'], [4.9, '0'], [5, '5'], [47, '45'], [47.5, '50'], [50, '50'],
    [52, '50'], [55, '60'], [104, '100'], [105, '110'],
  ])('%s → %s', (v, out) => expect(amt('Energy', v)).toBe(out))
})

describe('fats (c)(2)', () => {
  it.each([
    [0.49, '0'], [0.5, '0.5'], [0.74, '0.5'], [0.75, '1'], [1.2, '1'], [3.27, '3.5'],
    [4.74, '4.5'], [4.75, '5'], [5.4, '5'], [5.5, '6'], [12.49, '12'],
  ])('total fat %s → %s', (v, out) => expect(amt('Total Fat', v)).toBe(out))

  it('applies the same rule to trans, saturated and unsaturated fats', () => {
    for (const n of ['Saturated Fat', 'Trans Fat', 'Polyunsaturated Fat', 'Monounsaturated Fat'])
      expect(amt(n, 0.3)).toBe('0')
  })
})

describe('cholesterol (c)(3)', () => {
  it.each([[1.9, '0'], [2, '<5'], [4.9, '<5'], [5, '5'], [7.4, '5'], [7.5, '10'], [12, '10']])(
    '%s → %s', (v, out) => expect(amt('Cholesterol', v)).toBe(out))
})

describe('sodium (c)(4)', () => {
  it.each([[4.9, '0'], [5, '5'], [137, '135'], [140, '140'], [141, '140'], [145, '150'], [1234, '1230']])(
    '%s → %s', (v, out) => expect(amt('Sodium', v)).toBe(out))
})

describe('carbohydrate, fiber, sugars, protein (c)(6)–(7)', () => {
  it.each([[0.49, '0'], [0.5, '<1'], [0.99, '<1'], [1, '1'], [1.49, '1'], [1.5, '2'], [27.4, '27']])(
    '%s → %s', (v, out) => {
      for (const n of ['Total Carbohydrate', 'Dietary Fiber', 'Total Sugars', 'Added Sugars', 'Protein'])
        expect(amt(n, v)).toBe(out)
    })
})

describe('vitamin D, calcium, iron, potassium', () => {
  it('uses 0.1 mcg / 10 mg / 0.1 mg / 10 mg', () => {
    expect(amt('Vitamin D', 2.46)).toBe('2.5')
    expect(amt('Vitamin D', 2)).toBe('2')
    expect(amt('Calcium', 134)).toBe('130')
    expect(amt('Calcium', 135)).toBe('140')
    expect(amt('Iron', 0.74)).toBe('0.7')
    expect(amt('Potassium', 234)).toBe('230')
    expect(amt('Potassium', 3)).toBe('0')
  })
})

describe('%DV', () => {
  it('rounds non-vitamin/mineral nutrients to the nearest whole percent', () => {
    expect(declareDvPct(3.5, 78, false).declared).toBe(4)      // 4.49%
    expect(declareDvPct(0.39, 78, false).declared).toBe(1)     // 0.5%
  })
  it('uses 2/5/10 percent tiers for vitamins and minerals', () => {
    expect(declareDvPct(0.9, 100, true).declared).toBe(0)
    expect(declareDvPct(3, 100, true).declared).toBe(4)        // 3 → nearest 2 (half up)
    expect(declareDvPct(10, 100, true).declared).toBe(10)      // ≤10 → 2s
    expect(declareDvPct(12, 100, true).declared).toBe(10)      // >10 → 5s
    expect(declareDvPct(13, 100, true).declared).toBe(15)
    expect(declareDvPct(50, 100, true).declared).toBe(50)
    expect(declareDvPct(56, 100, true).declared).toBe(60)      // >50 → 10s
  })
})

describe('serving declarations', () => {
  it('serving size metric rounding (b)(7)(ii)', () => {
    expect(declareServingSize(30.4).text).toBe('30g')
    expect(declareServingSize(3.3).text).toBe('3.5g')
    expect(declareServingSize(1.26).text).toBe('1.3g')
  })
  it('servings per container (b)(8)', () => {
    expect(declareServings(4).text).toBe('4')
    expect(declareServings(4.2).text).toBe('about 4')
    expect(declareServings(3.3).text).toBe('about 3.5')
    expect(declareServings(10.4).text).toBe('about 10')
    expect(declareServings(0.6).text).toBe('about 1')
  })
})

describe('rule registry', () => {
  it('every rule ends with an open-ended increment band and has a description per band', () => {
    for (const r of AMOUNT_RULES) {
      const last = r.bands[r.bands.length - 1]
      expect(last.kind).toBe('increment')
      expect(describeBands(r)).toHaveLength(r.bands.length)
    }
  })
  it('describes bands readably', () => {
    expect(describeBands(ruleForNutrient('Total Fat')!)).toEqual([
      'under 0.5 g → declared as 0',
      '0.5 to under 5 g → nearest 0.5 g',
      '5 g and above → nearest 1 g',
    ])
    expect(describeBands(ruleForNutrient('Sodium')!)).toEqual([
      'under 5 mg → declared as 0',
      '5 to 140 mg → nearest 5 mg',
      'over 140 mg → nearest 10 mg',
    ])
  })
})
