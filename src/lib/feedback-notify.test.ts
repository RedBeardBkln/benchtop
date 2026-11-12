import { afterEach, describe, expect, it, vi } from 'vitest'
import { feedbackClaudePrompt } from './feedback'
import { feedbackEmail, feedbackRecipients } from './feedback-notify'
import { emailList } from './email'

const report = {
  id: 'f1', kind: 'bug', message: 'Print view <cuts> off\nthe last row', contactName: 'Ann Lee',
  contactEmail: 'ann@example.com', contactPhone: null, wantsContact: true, pagePath: '/projects/42',
  userAgent: 'Mozilla/5.0', createdAt: new Date('2026-11-12T10:00:00Z'), accountName: 'Ann Labs',
  accountId: 'a1', accountPlan: 'team', userId: 'u1', role: 'owner',
}

afterEach(() => vi.unstubAllEnvs())

describe('feedbackClaudePrompt', () => {
  it('includes every pertinent field and quotes the message', () => {
    const p = feedbackClaudePrompt(report, 'https://benchtop.solutions')
    expect(p).toContain('bug report (f1)')
    expect(p).toContain('> Print view <cuts> off\n> the last row')
    expect(p).toContain('Page: https://benchtop.solutions/projects/42')
    expect(p).toContain('Browser: Mozilla/5.0')
    expect(p).toContain('Submitted: 2026-11-12T10:00:00.000Z')
    expect(p).toContain('Email: ann@example.com')
    expect(p).toContain('Phone: not given')
    expect(p).toContain('Wants a reply: yes')
    expect(p).toContain('Team: Ann Labs (account a1)')
    expect(p).toContain('User id: u1')
  })
  it('asks for a feature to be scoped', () => {
    expect(feedbackClaudePrompt({ ...report, kind: 'feature' })).toContain('feature request through the in-app form')
  })
})

describe('feedbackEmail', () => {
  it('escapes HTML and flags a wanted reply in the subject', () => {
    const e = feedbackEmail(report, 'https://benchtop.solutions')
    expect(e.subject).toBe('[Benchtop] Bug report (reply wanted): Print view <cuts> off')
    expect(e.html).toContain('Print view &lt;cuts&gt; off')
    expect(e.html).not.toContain('<cuts>')
    expect(e.text).toContain(feedbackClaudePrompt(report, 'https://benchtop.solutions'))
  })
})

describe('recipients', () => {
  it('prefers FEEDBACK_NOTIFY_EMAILS, else the platform admins', () => {
    vi.stubEnv('PLATFORM_ADMIN_EMAILS', 'A@x.com, b@x.com')
    vi.stubEnv('FEEDBACK_NOTIFY_EMAILS', '')
    expect(feedbackRecipients()).toEqual(['a@x.com', 'b@x.com'])
    vi.stubEnv('FEEDBACK_NOTIFY_EMAILS', 'me@x.com')
    expect(feedbackRecipients()).toEqual(['me@x.com'])
  })
  it('drops blanks and duplicates', () => {
    expect(emailList(' a@x.com,,A@x.com, nope ')).toEqual(['a@x.com'])
  })
})
