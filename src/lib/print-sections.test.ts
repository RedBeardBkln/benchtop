import { describe, expect, it } from 'vitest'
import { DEFAULT_PRINT_SECTIONS, parsePrintSections, serializePrintSections } from './print-sections'

describe('parsePrintSections', () => {
  it('returns sections in print order, notes last', () => {
    expect(parsePrintSections('notes,formulation,validation')).toEqual(['formulation', 'validation', 'notes'])
  })

  it('accepts notes on its own', () => {
    expect(parsePrintSections('notes')).toEqual(['notes'])
  })

  it('falls back to the defaults when nothing valid is given', () => {
    expect(parsePrintSections('bogus')).toEqual(DEFAULT_PRINT_SECTIONS)
    expect(parsePrintSections(undefined)).toEqual(DEFAULT_PRINT_SECTIONS)
  })

  it('round-trips through serialize', () => {
    expect(parsePrintSections(serializePrintSections(['notes', 'process']))).toEqual(['process', 'notes'])
  })
})
