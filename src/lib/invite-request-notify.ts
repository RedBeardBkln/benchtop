import { after } from 'next/server'
import { emailList, escapeHtml, sendEmail } from '@/lib/email'
import {
  INVITE_COMPANY_TYPE_LABELS, INVITE_TEAM_SIZE_LABELS,
  type InviteCompanyType, type InviteTeamSize,
} from '@/lib/invite-requests'

// Emails Benchtop about each new beta request from the public site, once the response has gone, so a
// slow or failed send never holds up the form. "Approve" opens the admin Invitations page with the
// request filled into the invite form (sign-in required); nothing is sent to the requester.
// Recipients: INVITE_REQUEST_NOTIFY_EMAILS, else hello@benchtop.solutions.

export const DEFAULT_INVITE_REQUEST_NOTIFY = 'hello@benchtop.solutions'

export type NotifiedInviteRequest = {
  id: string
  name: string
  email: string
  company: string | null
  role: string | null
  companyType: InviteCompanyType | null
  teamSize: InviteTeamSize | null
  message: string | null
  referral: string | null
}

export function inviteRequestRecipients(): string[] {
  const own = emailList(process.env.INVITE_REQUEST_NOTIFY_EMAILS)
  return own.length ? own : [DEFAULT_INVITE_REQUEST_NOTIFY]
}

export function approveRequestUrl(origin: string, id: string): string {
  return `${origin}/admin/invitations?request=${encodeURIComponent(id)}`
}

export function inviteRequestEmail(r: NotifiedInviteRequest, origin: string) {
  const who = r.company ? `${r.name} (${r.company})` : r.name
  const subject = `[Benchtop] Beta invitation request: ${who}`.slice(0, 200)
  const approve = approveRequestUrl(origin, r.id)
  const review = `${origin}/admin/invitations`

  const rows: [string, string | null][] = [
    ['Name', r.name],
    ['Email', r.email],
    ['Company', r.company],
    ['Role', r.role],
    ['Company type', r.companyType && INVITE_COMPANY_TYPE_LABELS[r.companyType]],
    ['Team size', r.teamSize && INVITE_TEAM_SIZE_LABELS[r.teamSize]],
    ['Heard about us', r.referral],
  ]
  const filled = rows.filter((row): row is [string, string] => !!row[1])

  const text = [
    `New beta invitation request from ${who}.`,
    '',
    ...filled.map(([k, v]) => `${k}: ${v}`),
    ...(r.message ? ['', 'Message:', r.message] : []),
    '',
    `Approve (opens the invite form, filled in): ${approve}`,
    `All requests: ${review}`,
    '',
    `Reply to this email to reach ${r.email}.`,
  ].join('\n')

  const cell = 'padding:4px 12px 4px 0;vertical-align:top'
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px;color:#16200E;line-height:1.5">
<p style="margin:0 0 12px"><strong>New beta invitation request</strong> from ${escapeHtml(who)}.</p>
<table style="border-collapse:collapse;margin:0 0 12px">${filled
    .map(([k, v]) => `<tr><td style="${cell};color:#6b7280">${escapeHtml(k)}</td><td style="${cell}">${escapeHtml(v)}</td></tr>`)
    .join('')}</table>
${r.message
    ? `<p style="margin:0 0 4px;color:#6b7280">Message</p>
<p style="margin:0 0 16px;white-space:pre-wrap;background:#FBF8EC;border:1px solid #e5e1cf;border-radius:8px;padding:12px">${escapeHtml(r.message)}</p>`
    : ''}
<p style="margin:16px 0"><a href="${escapeHtml(approve)}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:8px">Approve invitation</a></p>
<p style="margin:0 0 4px;font-size:13px;color:#6b7280">Approve opens the invite form in Benchtop with this request filled in. Choose the account type, then create the invitation. Nothing is sent to them until you do.</p>
<p style="margin:12px 0 0;font-size:13px"><a href="${escapeHtml(review)}" style="color:#2563eb">See all requests</a> · Reply to this email to reach ${escapeHtml(r.email)}.</p>
</div>`

  return { subject, text, html }
}

export function notifyInviteRequest(r: NotifiedInviteRequest, origin: string): void {
  const to = inviteRequestRecipients()
  after(async () => {
    const { subject, text, html } = inviteRequestEmail(r, origin)
    const sent = await sendEmail({ to, subject, text, html, replyTo: r.email })
    if (!sent) console.error('[invite-requests] notification email not sent for', r.id)
  })
}
