import { describe, expect, it } from 'vitest'
import {
  LEGAL_DRAFT_NOTICE, PRIVACY_EFFECTIVE_DATE, PRIVACY_VERSION, TERMS_EFFECTIVE_DATE, TERMS_VERSION,
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
})
