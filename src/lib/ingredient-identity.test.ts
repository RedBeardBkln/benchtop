import { describe, expect, it } from 'vitest'
import {
  describeIdentity, duplicateCounts, findDuplicateGroups, identityKey, normalizePart, sameIdentity,
} from './ingredient-identity'
import { formulationFileName, nfpFileName } from './download-name'

describe('ingredient identity', () => {
  it('normalises case, whitespace and accents', () => {
    expect(normalizePart('  Crème   FRAÎCHE ')).toBe('creme fraiche')
    expect(normalizePart(null)).toBe('')
  })

  it('treats null, empty and whitespace-only optional fields as the same', () => {
    expect(sameIdentity({ name: 'Oats', brandName: null }, { name: 'oats', brandName: '  ', supplierName: undefined })).toBe(true)
  })

  it('is a duplicate only when name, brand, supplier and item code ALL match', () => {
    const base = { name: 'Pea Protein', brandName: 'Acme', supplierName: 'Sysco', itemCode: 'P1' }
    expect(sameIdentity(base, { ...base, name: 'pea  protein' })).toBe(true)
    expect(sameIdentity(base, { ...base, name: 'Pea Protein Isolate' })).toBe(false)
    expect(sameIdentity(base, { ...base, brandName: 'Other' })).toBe(false)
    expect(sameIdentity(base, { ...base, supplierName: 'US Foods' })).toBe(false)
    expect(sameIdentity(base, { ...base, itemCode: 'P2' })).toBe(false)
    expect(sameIdentity(base, { ...base, itemCode: null })).toBe(false)
  })

  it('does not confuse values that merely concatenate the same way', () => {
    expect(identityKey({ name: 'a b', brandName: 'c' })).not.toBe(identityKey({ name: 'a', brandName: 'b c' }))
  })

  it('finds duplicate groups and per-entry counts', () => {
    const rows = [
      { id: '1', name: 'Oats' },
      { id: '2', name: 'oats ' },
      { id: '3', name: 'Oats', supplierName: 'X' },
      { id: '4', name: 'Rice' },
      { id: '5', name: 'RICE' },
      { id: '6', name: 'rice' },
    ]
    const groups = findDuplicateGroups(rows)
    expect(groups.map(g => g.map(r => r.id))).toEqual([['1', '2'], ['4', '5', '6']])
    const counts = duplicateCounts(rows)
    expect(counts.get('1')).toBe(1)
    expect(counts.get('5')).toBe(2)
    expect(counts.has('3')).toBe(false)
  })

  it('describes an identity for messages', () => {
    expect(describeIdentity({ name: 'Oats', brandName: 'Bob', supplierName: null, itemCode: '12' }))
      .toBe('Oats · Brand: Bob · Item #12')
  })
})

describe('download file names', () => {
  const d = new Date(2026, 9, 8) // Oct 8 2026, local
  it('formats a formulation download', () => {
    expect(formulationFileName({ formulationName: 'Oat Bar', iteration: 2, clientName: 'Acme Foods', date: d }))
      .toBe('Oat Bar_2_Acme Foods_2026-10-08')
  })
  it('prefixes NFP downloads', () => {
    expect(nfpFileName({ formulationName: 'Oat Bar', iteration: 2, clientName: 'Acme Foods', date: d }))
      .toBe('NFP_Oat Bar_2_Acme Foods_2026-10-08')
  })
  it('omits the client segment when there is none', () => {
    expect(formulationFileName({ formulationName: 'Oat Bar', iteration: 1, clientName: '  ', date: d })).toBe('Oat Bar_1_2026-10-08')
    expect(nfpFileName({ formulationName: 'Oat Bar', iteration: 1, clientName: null, date: d })).toBe('NFP_Oat Bar_1_2026-10-08')
  })
  it('strips characters that are illegal in file names and trailing dots', () => {
    expect(formulationFileName({ formulationName: 'Oat/Bar: "v2"?', iteration: 3, clientName: 'A*B <Co.>', date: d }))
      .toBe('Oat Bar v2_3_A B Co_2026-10-08')
  })
  it('caps very long names', () => {
    const n = formulationFileName({ formulationName: 'x'.repeat(200), iteration: 1, date: d })
    expect(n.length).toBeLessThanOrEqual(60 + '_1_2026-10-08'.length)
  })
})
