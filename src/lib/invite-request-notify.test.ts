import { afterEach, describe, expect, it, vi } from 'vitest'
import { approveRequestUrl, inviteRequestEmail, inviteRequestRecipients } from './invite-request-notify'

const req = {
  id: 'a3f1c2d4-0000-4000-8000-000000000001', name: 'Ada <Baker>', email: 'ada@example.com', company: 'Oat Co',
  role: 'R&D lead', companyType: 'brand' as const, teamSize: '2-5' as const,
  message: 'We make oat milk\n& want <b>better</b> specs', referral: null,
}
const origin = 'https://benchtop.solutions'

afterEach(() => vi.unstubAllEnvs())

describe('inviteRequestEmail', () => {
  it('links Approve to the prefilled invite form', () => {
    const e = inviteRequestEmail(req, origin)
    const url = approveRequestUrl(origin, req.id)
    expect(url).toBe(`${origin}/admin/invitations?request=${req.id}`)
    expect(e.text).toContain(url)
    expect(e.html).toContain(`href="${url}"`)
    expect(e.html).toContain('Approve invitation')
  })

  it('shows the details, escaped, and skips blanks', () => {
    const e = inviteRequestEmail(req, origin)
    expect(e.subject).toBe('[Benchtop] Beta invitation request: Ada <Baker> (Oat Co)')
    expect(e.text).toContain('Company type: Food or beverage brand')
    expect(e.text).toContain('Team size: 2 to 5 people')
    expect(e.text).not.toContain('Heard about us')
    expect(e.html).toContain('Ada &lt;Baker&gt;')
    expect(e.html).toContain('&lt;b&gt;better&lt;/b&gt;')
    expect(e.html).not.toContain('<b>better')
  })
})

describe('recipients', () => {
  it('defaults to hello@benchtop.solutions, overridable by env', () => {
    vi.stubEnv('INVITE_REQUEST_NOTIFY_EMAILS', '')
    expect(inviteRequestRecipients()).toEqual(['hello@benchtop.solutions'])
    vi.stubEnv('INVITE_REQUEST_NOTIFY_EMAILS', 'Me@x.com, you@x.com')
    expect(inviteRequestRecipients()).toEqual(['me@x.com', 'you@x.com'])
  })
})
