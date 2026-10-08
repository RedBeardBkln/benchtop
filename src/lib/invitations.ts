import { createHash, randomBytes } from 'crypto'

// Pure invitation helpers (no DB access) so they can be unit-tested. DB lookups live in
// invitations-server.ts.

export const DEFAULT_INVITE_EXPIRY_DAYS = 7
export const MAX_INVITE_EXPIRY_DAYS = 60

export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked'

// 32 random bytes, base64url (43 chars, 256 bits of entropy)
export function generateToken(): string {
  return randomBytes(32).toString('base64url')
}

// Only this hash is ever stored or compared; the plaintext token exists in the invite link only.
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function inviteExpiry(now: Date, days: number = DEFAULT_INVITE_EXPIRY_DAYS): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
}

export function inviteUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, '')}/invite/${token}`
}

export function deriveStatus(
  inv: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date },
  now: Date = new Date(),
): InviteStatus {
  if (inv.acceptedAt) return 'accepted'
  if (inv.revokedAt) return 'revoked'
  if (inv.expiresAt.getTime() <= now.getTime()) return 'expired'
  return 'pending'
}

// Why a token cannot be redeemed ('invalid' covers unknown/garbage tokens)
export type InviteFailure = 'invalid' | 'expired' | 'revoked' | 'used'

export function failureReason(
  inv: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date } | null | undefined,
  now: Date = new Date(),
): InviteFailure | null {
  if (!inv) return 'invalid'
  switch (deriveStatus(inv, now)) {
    case 'accepted': return 'used'
    case 'revoked': return 'revoked'
    case 'expired': return 'expired'
    default: return null
  }
}

export const INVITE_FAILURE_MESSAGES: Record<InviteFailure, string> = {
  invalid: 'This invitation link is not valid.',
  expired: 'This invitation has expired. Please ask for a new one.',
  revoked: 'This invitation has been withdrawn.',
  used: 'This invitation has already been used. If that was you, sign in instead.',
}
