import { z } from 'zod'

export const FEEDBACK_KINDS = ['bug', 'feature'] as const
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]

export const FEEDBACK_KIND_LABELS: Record<FeedbackKind, string> = {
  bug: 'Bug report',
  feature: 'Feature request',
}

export const FEEDBACK_MESSAGE_MAX = 5000

// Only the full name is required on a profile, so a profile with one is complete
export function isProfileComplete(profile: { fullName: string | null } | null | undefined): boolean {
  return !!profile?.fullName?.trim()
}

export const feedbackSchema = z.object({
  kind: z.enum(FEEDBACK_KINDS),
  message: z.string().trim().min(1, 'Describe the bug or feature').max(FEEDBACK_MESSAGE_MAX),
  contactName: z.string().trim().min(1, 'Name is required').max(120),
  contactEmail: z.string().trim().email('Enter a valid email').max(254),
  contactPhone: z
    .string()
    .trim()
    .max(30)
    .nullish()
    .refine(v => !v || /^\+?[0-9][0-9 ().-]{4,}$/.test(v), 'Enter a valid phone number')
    .transform(v => (v ? v : null)),
  wantsContact: z.boolean(),
  pagePath: z.string().max(500).nullish(),
})

export type FeedbackInput = z.infer<typeof feedbackSchema>

// Everything needed to act on one submission, used by the admin email and the "Copy for Claude" button
export type FeedbackReport = {
  id: string
  kind: string
  message: string
  contactName: string
  contactEmail: string
  contactPhone: string | null
  wantsContact: boolean
  pagePath: string | null
  userAgent: string | null
  createdAt: Date | string
  accountName: string
  accountId?: string
  accountPlan?: string | null
  userId?: string
  role?: string | null
}

/**
 * A plain-text brief to paste straight into a Claude Code thread on the benchtop repo: what to do,
 * where it happened, who sent it, and the report itself, quoted so it reads as the user's words.
 */
export function feedbackClaudePrompt(r: FeedbackReport, origin = 'https://benchtop.solutions'): string {
  const isBug = r.kind === 'bug'
  const label = FEEDBACK_KIND_LABELS[r.kind as FeedbackKind] ?? r.kind
  const when = new Date(r.createdAt).toISOString()
  const page = r.pagePath ? `${origin}${r.pagePath}` : 'not recorded'
  const quoted = r.message.split(/\r?\n/).map(l => `> ${l}`).join('\n')
  const ask = isBug
    ? 'A Benchtop user submitted a bug report through the in-app form. Please reproduce it from the code, find the root cause, and fix it. If anything is unclear, list what you would ask the user.'
    : 'A Benchtop user submitted a feature request through the in-app form. Please scope it against the current code, propose how it would work, and build it if the scope is clear. If anything is unclear, list what you would ask the user.'

  const lines = [
    `## Benchtop ${label.toLowerCase()} (${r.id})`,
    '',
    ask,
    '',
    '### Report (the user’s own words)',
    quoted,
    '',
    '### Where',
    `- Page: ${page}`,
    `- Browser: ${r.userAgent ?? 'not recorded'}`,
    `- Submitted: ${when}`,
    '',
    '### Who',
    `- Name: ${r.contactName}`,
    `- Email: ${r.contactEmail}`,
    `- Phone: ${r.contactPhone ?? 'not given'}`,
    `- Wants a reply: ${r.wantsContact ? 'yes' : 'no'}`,
    `- Team: ${r.accountName}${r.accountId ? ` (account ${r.accountId})` : ''}`,
  ]
  if (r.accountPlan) lines.push(`- Plan: ${r.accountPlan}`)
  if (r.role) lines.push(`- Role on team: ${r.role}`)
  if (r.userId) lines.push(`- User id: ${r.userId}`)
  lines.push('', `Admin view: ${origin}/admin/feedback`)
  return lines.join('\n')
}
