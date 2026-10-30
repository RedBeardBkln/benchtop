import { describe, expect, it } from 'vitest'
import { describeActivity, parseActivityPath, shouldLogActivity } from './activity'
import { describeAdminAction } from './admin-actions'

const ID = '3f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f'

describe('shouldLogActivity', () => {
  it('logs changes to the app API only', () => {
    expect(shouldLogActivity('PATCH', `/api/formulations/${ID}`)).toBe(true)
    expect(shouldLogActivity('post', '/api/projects')).toBe(true)
    expect(shouldLogActivity('GET', '/api/projects')).toBe(false)
    expect(shouldLogActivity('POST', '/projects')).toBe(false)
    expect(shouldLogActivity(null, '/api/projects')).toBe(false)
  })

  it('skips platform admin, Stripe and billing sync calls', () => {
    expect(shouldLogActivity('POST', '/api/admin/accounts')).toBe(false)
    expect(shouldLogActivity('POST', '/api/admin')).toBe(false)
    expect(shouldLogActivity('POST', '/api/stripe/webhook')).toBe(false)
    expect(shouldLogActivity('POST', '/api/billing/sync')).toBe(false)
    expect(shouldLogActivity('POST', '/api/administer')).toBe(true)
  })
})

describe('parseActivityPath', () => {
  it('finds the area, the record and what was done to it', () => {
    expect(parseActivityPath(`/api/formulations/${ID}/lines`)).toEqual({ entity: 'formulations', entityId: ID, detail: 'lines' })
    expect(parseActivityPath('/api/projects')).toEqual({ entity: 'projects', entityId: null, detail: null })
    expect(parseActivityPath(`/api/sous-chef/notes/${ID}`)).toEqual({ entity: 'sous-chef', entityId: null, detail: 'notes' })
  })
})

describe('describeActivity', () => {
  it('reads like a sentence', () => {
    expect(describeActivity('PATCH', `/api/formulations/${ID}`)).toBe('Updated formulation')
    expect(describeActivity('POST', '/api/projects')).toBe('Created project')
    expect(describeActivity('DELETE', `/api/clients/${ID}/contacts/${ID}`)).toBe('Client: contacts (deleted)')
    expect(describeActivity('POST', '/api/time-entries')).toBe('Created time entry')
  })
})

describe('describeAdminAction', () => {
  it('describes plan changes and suspensions', () => {
    expect(describeAdminAction('plan.change', {
      from: { plan: 'paid', freeUntil: null },
      to: { plan: 'free_lifetime', maxUsers: 3 },
    })).toBe('Changed plan: Paid → Free for life (up to 3 users)')
    expect(describeAdminAction('account.suspend', { reason: 'Unpaid' })).toBe('Suspended the account (Unpaid)')
    expect(describeAdminAction('user.remove', { email: 'a@b.co' })).toBe('Removed a@b.co from the account')
    expect(describeAdminAction('something.new', {})).toBe('something.new')
  })
})
