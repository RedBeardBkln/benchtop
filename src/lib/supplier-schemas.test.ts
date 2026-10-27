import { describe, expect, it } from 'vitest'
import { EMPTY_ADDRESS } from './client-schemas'
import { normalizeSupplierFields, shortAddress, supplierCreateSchema, supplierPatchSchema } from './supplier-schemas'

describe('supplier fields', () => {
  it('requires a name and trims it', () => {
    expect(supplierCreateSchema.safeParse({ name: '  ' }).success).toBe(false)
    expect(supplierCreateSchema.parse({ name: '  Cargill  ' }).name).toBe('Cargill')
  })

  it('still accepts the name-and-website body the ingredient page sends', () => {
    expect(supplierCreateSchema.parse({ name: 'AIDP', websiteUrl: null }).websiteUrl).toBeNull()
  })

  it('adds https:// to a bare website and rejects junk', () => {
    expect(supplierPatchSchema.parse({ websiteUrl: 'kerry.com' }).websiteUrl).toBe('https://kerry.com')
    expect(supplierPatchSchema.parse({ websiteUrl: 'http://kerry.com' }).websiteUrl).toBe('http://kerry.com')
    expect(supplierPatchSchema.parse({ websiteUrl: '' }).websiteUrl).toBeNull()
    expect(supplierPatchSchema.safeParse({ websiteUrl: 'not a url' }).success).toBe(false)
  })

  it('accepts a blank email but rejects a malformed one', () => {
    expect(supplierPatchSchema.parse({ email: '' }).email).toBeNull()
    expect(supplierPatchSchema.safeParse({ email: 'nope' }).success).toBe(false)
  })

  it('takes an optional first contact, which needs a name', () => {
    expect(supplierCreateSchema.safeParse({ name: 'X', contact: { name: '', email: 'a@b.co' } }).success).toBe(false)
    expect(supplierCreateSchema.parse({ name: 'X', contact: { name: 'Pat', email: '' } }).contact?.email).toBeNull()
  })

  it('stores blank text and an empty address as null', () => {
    expect(normalizeSupplierFields({ name: 'X', phone: '', address: EMPTY_ADDRESS })).toEqual({ name: 'X', phone: null, address: null })
    const address = { ...EMPTY_ADDRESS, city: 'Ames' }
    expect(normalizeSupplierFields({ address }).address).toEqual(address)
  })

  it('summarizes an address as city, region, country', () => {
    expect(shortAddress({ ...EMPTY_ADDRESS, city: 'Ames', region: 'IA', country: 'USA' })).toBe('Ames, IA, USA')
    expect(shortAddress(null)).toBe('')
  })
})
