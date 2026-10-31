import { z } from 'zod'
import { MAX_ENTRIES } from '@/lib/time-tracking'

// The invoicing connection: a key an outside invoicing app uses to read one person's unbilled time
// for a client and mark it billed on an invoice. Not a product feature: only the logins below can
// make a key, and a key stops working if its login is taken off the list. Pure rules only.

const ALLOWED_EMAILS = ['eric@launchtime.solutions']

export function canUseInvoicingConnection(email: string | null | undefined): boolean {
  return !!email && ALLOWED_EMAILS.includes(email.trim().toLowerCase())
}

export const CONNECTION_KEY_PREFIX = 'btk_'
// btk_ + 32 random bytes in base64url
const KEY_SHAPE = /^btk_[A-Za-z0-9_-]{43}$/

export function looksLikeConnectionKey(key: string): boolean {
  return KEY_SHAPE.test(key)
}

/** The key from an `Authorization: Bearer ...` header, or null */
export function bearerKey(header: string | null): string | null {
  const m = header?.match(/^Bearer\s+(\S+)$/i)
  return m && looksLikeConnectionKey(m[1]) ? m[1] : null
}

export const INVOICE_REF_MAX = 60

/** Mark entries billed on an invoice, or take them off it (only entries still billed on that invoice) */
export const connectionBilledSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(MAX_ENTRIES),
  billed: z.boolean(),
  invoice: z.string().trim().min(1).max(INVOICE_REF_MAX),
})
export type ConnectionBilled = z.infer<typeof connectionBilledSchema>

type EntryState = { id: string; billed: boolean; billedRef: string | null }

/**
 * Which of the requested entries a billed change applies to. Marking billed: unbilled entries, and
 * ones already on this invoice (a retry). Unmarking: only entries billed on this invoice, so voiding
 * an invoice never unbills time billed some other way. `missing`: not found or not the caller's.
 */
export function planBilledChange(req: ConnectionBilled, rows: EntryState[]) {
  const byId = new Map(rows.map(r => [r.id, r]))
  const change: string[] = []
  const unchanged: string[] = []
  const conflicts: string[] = []
  const missing: string[] = []
  for (const id of new Set(req.ids)) {
    const r = byId.get(id)
    if (!r) missing.push(id)
    else if (req.billed) {
      if (!r.billed) change.push(id)
      else if (r.billedRef === req.invoice) unchanged.push(id)
      else conflicts.push(id)
    } else {
      if (r.billed && r.billedRef === req.invoice) change.push(id)
      else if (!r.billed) unchanged.push(id)
      else conflicts.push(id)
    }
  }
  return { change, unchanged, conflicts, missing }
}
