import { describe, expect, it } from 'vitest'
import {
  LEGAL_DRAFT_NOTICE, needsLegalAcceptance, PRIVACY_EFFECTIVE_DATE, PRIVACY_VERSION, TERMS_EFFECTIVE_DATE, TERMS_VERSION,
} from './legal'

describe('legal constants', () => {
  it('versions are ISO dates and effective dates are present', () => {
    expect(TERMS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(PRIVACY_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(TERMS_EFFECTIVE_DATE.length).toBeGreaterThan(0)
    expect(PRIVACY_EFFECTIVE_DATE.length).toBeGreaterThan(0)
  })

  it('keeps the draft notice', () => {
    expect(LEGAL_DRAFT_NOTICE).toMatch(/pending legal review/i)
  })

  it('requires acceptance of the current versions of both documents', () => {
    expect(needsLegalAcceptance(null)).toBe(true)
    expect(needsLegalAcceptance({ termsVersion: null, privacyVersion: null })).toBe(true)
    expect(needsLegalAcceptance({ termsVersion: TERMS_VERSION, privacyVersion: '2020-01-01' })).toBe(true)
    expect(needsLegalAcceptance({ termsVersion: '2020-01-01', privacyVersion: PRIVACY_VERSION })).toBe(true)
    expect(needsLegalAcceptance({ termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION })).toBe(false)
  })
})
