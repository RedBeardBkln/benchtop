// Transactional email through Resend's HTTP API (the same Resend account and verified domain that
// Supabase auth emails use over SMTP). Sending never throws: callers get false when it didn't go.

const FROM = 'benchtop <noreply@benchtop.solutions>'

export type Email = { to: string[]; subject: string; text: string; html?: string; replyTo?: string }

export async function sendEmail(email: Email): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim()
  if (!key) {
    console.warn('[email] RESEND_API_KEY is not set; email not sent:', email.subject)
    return false
  }
  if (email.to.length === 0) return false
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: email.to,
        subject: email.subject,
        text: email.text,
        html: email.html,
        reply_to: email.replyTo,
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      console.error('[email] Resend rejected the email', res.status, (await res.text().catch(() => '')).slice(0, 500))
      return false
    }
    return true
  } catch (e) {
    console.error('[email] could not reach Resend', e)
    return false
  }
}

/** Comma-separated env list of addresses, trimmed, lower-cased and de-duplicated */
export function emailList(value: string | undefined): string[] {
  return [...new Set((value ?? '').split(',').map(s => s.trim().toLowerCase()).filter(s => s.includes('@')))]
}

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
