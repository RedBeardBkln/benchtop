import { describe, expect, it } from 'vitest'
import { nutrientSourceFor } from './nutrient-source'

describe('nutrientSourceFor', () => {
  it('gives a changed value the new source reference', () => {
    expect(nutrientSourceFor({ amount: '12', sourceRef: 'COA 2024', originalAmount: '10' }, 'COA 2026')).toBe('COA 2026')
  })
  it('keeps the old note on an untouched value', () => {
    expect(nutrientSourceFor({ amount: '10', sourceRef: 'COA 2024', originalAmount: '10.0' }, 'COA 2026')).toBe('COA 2024')
  })
  it('keeps the old note on a changed value when no new reference is typed', () => {
    expect(nutrientSourceFor({ amount: '12', sourceRef: 'COA 2024', originalAmount: '10' }, '  ')).toBe('COA 2024')
  })
  it('uses the reference for new values, and the parsed note for parsed ones', () => {
    expect(nutrientSourceFor({ amount: '5', sourceRef: '' }, 'Spec sheet')).toBe('Spec sheet')
    expect(nutrientSourceFor({ amount: '5', sourceRef: '' }, '')).toBe('')
    expect(nutrientSourceFor({ amount: '5', sourceRef: 'Parsed from: COA', fromParse: true, originalAmount: '4' }, 'X'))
      .toBe('Parsed from: COA')
  })
})
