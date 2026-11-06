import { describe, expect, it } from 'vitest'
import { inviteNoteFor, inviteRequestSchema, isBotSubmission } from './invite-requests'

const valid = { name: ' Ada Baker ', email: ' Ada@Example.COM ', consent: true }

describe('invite request schema', () => {
  it('accepts the minimum and normalizes it', () => {
    const r = inviteRequestSchema.parse(valid)
    expect(r.name).toBe('Ada Baker')
    expect(r.email).toBe('ada@example.com')
    expect(r.company).toBeNull()
    expect(r.companyType).toBeNull()
    expect(r.message).toBeNull()
  })

  it('turns blank optional fields into null', () => {
    const r = inviteRequestSchema.parse({ ...valid, company: '  ', role: '', companyType: null, teamSize: undefined })
    expect(r.company).toBeNull()
    expect(r.role).toBeNull()
    expect(r.teamSize).toBeNull()
  })

  it('requires consent, a name and a valid email', () => {
    expect(inviteRequestSchema.safeParse({ ...valid, consent: false }).success).toBe(false)
    expect(inviteRequestSchema.safeParse({ ...valid, name: ' ' }).success).toBe(false)
    expect(inviteRequestSchema.safeParse({ ...valid, email: 'nope' }).success).toBe(false)
  })

  it('rejects unknown company types and team sizes', () => {
    expect(inviteRequestSchema.safeParse({ ...valid, companyType: 'pirate' }).success).toBe(false)
    expect(inviteRequestSchema.safeParse({ ...valid, teamSize: '1000' }).success).toBe(false)
    expect(inviteRequestSchema.safeParse({ ...valid, companyType: 'consultant', teamSize: '2-5' }).success).toBe(true)
  })
})

describe('honeypot and notes', () => {
  it('flags only a filled-in hidden field', () => {
    expect(isBotSubmission({})).toBe(false)
    expect(isBotSubmission({ website: ' ' })).toBe(false)
    expect(isBotSubmission({ website: 'http://spam.example' })).toBe(true)
  })

  it('builds the invitation note', () => {
    expect(inviteNoteFor({ name: 'Ada', company: 'Oat Co' })).toBe('Beta request: Ada, Oat Co')
    expect(inviteNoteFor({ name: 'Ada', company: null })).toBe('Beta request: Ada')
  })
})
