import { after } from 'next/server'
import { emailList, escapeHtml, sendEmail } from '@/lib/email'
import { FEEDBACK_KIND_LABELS, feedbackClaudePrompt, type FeedbackKind, type FeedbackReport } from '@/lib/feedback'

// Emails the platform admins about each new bug report or feature request, once the response to the
// user has gone, so a slow or failed send never holds up or fails the submission.
// Recipients: FEEDBACK_NOTIFY_EMAILS, else PLATFORM_ADMIN_EMAILS.

export function feedbackRecipients(): string[] {
  const own = emailList(process.env.FEEDBACK_NOTIFY_EMAILS)
  return own.length ? own : emailList(process.env.PLATFORM_ADMIN_EMAILS)
}

export function feedbackEmail(r: FeedbackReport, origin: string) {
  const label = FEEDBACK_KIND_LABELS[r.kind as FeedbackKind] ?? r.kind
  const firstLine = r.message.split(/\r?\n/)[0].trim()
  const summary = firstLine.length > 70 ? `${firstLine.slice(0, 67)}…` : firstLine
  const subject = `[Benchtop] ${label}${r.wantsContact ? ' (reply wanted)' : ''}: ${summary}`
  const prompt = feedbackClaudePrompt(r, origin)

  const text = [
    `New ${label.toLowerCase()} from ${r.contactName} (${r.accountName}).`,
    r.wantsContact ? `They asked to be contacted: reply to this email to reach ${r.contactEmail}.` : 'They did not ask to be contacted.',
    '',
    'Copy everything below this line into Claude Code:',
    '----------------------------------------',
    prompt,
    '----------------------------------------',
  ].join('\n')

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px;color:#16200E;line-height:1.5">
<p style="margin:0 0 8px"><strong>New ${escapeHtml(label.toLowerCase())}</strong> from ${escapeHtml(r.contactName)} (${escapeHtml(r.accountName)}).</p>
<p style="margin:0 0 16px">${r.wantsContact
    ? `<strong style="color:#b45309">They asked to be contacted.</strong> Reply to this email to reach ${escapeHtml(r.contactEmail)}.`
    : 'They did not ask to be contacted.'}</p>
<p style="margin:0 0 6px;font-weight:600">Copy this into Claude Code:</p>
<pre style="white-space:pre-wrap;word-break:break-word;background:#FBF8EC;border:1px solid #e5e1cf;border-radius:8px;padding:14px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;margin:0">${escapeHtml(prompt)}</pre>
<p style="margin:16px 0 0"><a href="${escapeHtml(origin)}/admin/feedback" style="color:#2563eb">Open feedback in Benchtop</a></p>
</div>`

  return { subject, text, html }
}

export function notifyFeedback(r: FeedbackReport, origin: string): void {
  const to = feedbackRecipients()
  if (to.length === 0) {
    console.warn('[feedback] no FEEDBACK_NOTIFY_EMAILS or PLATFORM_ADMIN_EMAILS; not emailing', r.id)
    return
  }
  after(async () => {
    const { subject, text, html } = feedbackEmail(r, origin)
    const sent = await sendEmail({ to, subject, text, html, replyTo: r.contactEmail })
    if (!sent) console.error('[feedback] notification email not sent for', r.id)
  })
}
