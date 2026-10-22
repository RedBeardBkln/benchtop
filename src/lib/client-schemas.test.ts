import { describe, expect, it } from 'vitest'
import { clientFieldsSchema, clientPatchSchema, contactSchema, EMPTY_ADDRESS, normalizeClientFields } from './client-schemas'

describe('client fields', () => {
  it('requires a name and trims it', () => {
    expect(clientFieldsSchema.safeParse({ name: '  ' }).success).toBe(false)
    expect(clientFieldsSchema.parse({ name: '  Acme  ' }).name).toBe('Acme')
  })

  it('accepts a blank billing email but rejects a malformed one', () => {
    expect(clientPatchSchema.parse({ billingEmail: '' }).billingEmail).toBeNull()
    expect(clientPatchSchema.safeParse({ billingEmail: 'not-an-email' }).success).toBe(false)
  })

  it('needs both a carrier and an account number for extra carrier accounts', () => {
    expect(clientPatchSchema.safeParse({ otherCarrierAccounts: [{ carrier: 'USPS', accountNumber: '' }] }).success).toBe(false)
    expect(clientPatchSchema.safeParse({ otherCarrierAccounts: [{ carrier: 'USPS', accountNumber: '123' }] }).success).toBe(true)
  })

  it('stores blank text and empty addresses as null', () => {
    const d = normalizeClientFields(clientPatchSchema.parse({
      name: 'Acme',
      taxId: '',
      upsAccount: ' 1Z999 ',
      billingAddress: EMPTY_ADDRESS,
      shippingAddress: { ...EMPTY_ADDRESS, city: 'Denver' },
    }))
    expect(d).toMatchObject({ name: 'Acme', taxId: null, upsAccount: '1Z999', billingAddress: null })
    expect(d.shippingAddress?.city).toBe('Denver')
    expect('website' in d).toBe(false)
  })
})

describe('contacts', () => {
  it('requires a name and allows a blank email', () => {
    expect(contactSchema.safeParse({ name: '' }).success).toBe(false)
    expect(contactSchema.parse({ name: 'Pat', email: '' }).email).toBeNull()
  })
})
