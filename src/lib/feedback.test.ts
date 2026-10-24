import { describe, expect, it } from 'vitest'
import { feedbackSchema, isProfileComplete } from './feedback'

const valid = {
  kind: 'bug', message: ' The print view cuts off ', contactName: 'Ann', contactEmail: 'ann@example.com',
  contactPhone: '', wantsContact: true, pagePath: '/projects',
}

describe('isProfileComplete', () => {
  it('needs a full name', () => {
    expect(isProfileComplete({ fullName: 'Ann Lee' })).toBe(true)
    expect(isProfileComplete({ fullName: '  ' })).toBe(false)
    expect(isProfileComplete({ fullName: null })).toBe(false)
    expect(isProfileComplete(null)).toBe(false)
  })
})

describe('feedbackSchema', () => {
  it('trims the message and blanks an empty phone', () => {
    const r = feedbackSchema.parse(valid)
    expect(r.message).toBe('The print view cuts off')
    expect(r.contactPhone).toBeNull()
  })
  it('rejects an empty message, bad email or unknown kind', () => {
    expect(feedbackSchema.safeParse({ ...valid, message: '   ' }).success).toBe(false)
    expect(feedbackSchema.safeParse({ ...valid, contactEmail: 'nope' }).success).toBe(false)
    expect(feedbackSchema.safeParse({ ...valid, kind: 'praise' }).success).toBe(false)
  })
})
