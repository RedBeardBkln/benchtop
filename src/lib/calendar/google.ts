import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { calendarConnections } from '@/lib/db/schema'
import { decryptApiKey, encryptApiKey, isKeyEncryptionConfigured } from '@/lib/ai/key-crypto'
import type { GoogleEvent } from './events'

// Google Calendar, read-only, for the time log. A person connects their own calendar from
// Settings → Calendar (OAuth with offline access); the refresh token is stored encrypted and used
// to fetch a short-lived access token each time events are read.
//
// Needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (a Google Cloud "Web application" OAuth client
// with the Calendar API enabled and <app origin>/api/calendar/google/callback as a redirect URI),
// plus AI_KEY_SECRET for the encryption.

export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events.readonly'
const SCOPES = ['openid', 'email', GOOGLE_CALENDAR_SCOPE]
export const CALLBACK_PATH = '/api/calendar/google/callback'
export const STATE_COOKIE = 'bt_gcal_state'

export class CalendarNotConnectedError extends Error {
  constructor(message = 'Google Calendar is not connected') { super(message); this.name = 'CalendarNotConnectedError' }
}

export function isGoogleCalendarConfigured(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID?.trim() && !!process.env.GOOGLE_CLIENT_SECRET?.trim() && isKeyEncryptionConfigured()
}

function client() {
  return { id: process.env.GOOGLE_CLIENT_ID!.trim(), secret: process.env.GOOGLE_CLIENT_SECRET!.trim() }
}

export function authorizeUrl(origin: string, state: string, loginHint?: string): string {
  const q = new URLSearchParams({
    client_id: client().id,
    redirect_uri: origin + CALLBACK_PATH,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    // Always ask, so Google returns a refresh token even when this app was approved before
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  })
  if (loginHint) q.set('login_hint', loginHint)
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`
}

type TokenResponse = {
  access_token?: string
  refresh_token?: string
  scope?: string
  id_token?: string
  error?: string
  error_description?: string
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: client().id, client_secret: client().secret, ...body }),
    cache: 'no-store',
  })
  return (await r.json().catch(() => ({ error: `http_${r.status}` }))) as TokenResponse
}

// The id_token came straight from Google over TLS in answer to our own request, so its payload
// can be read without checking the signature
function emailFromIdToken(idToken: string | undefined): string | null {
  try {
    const payload = JSON.parse(Buffer.from(idToken!.split('.')[1], 'base64url').toString('utf8'))
    return typeof payload.email === 'string' ? payload.email : null
  } catch {
    return null
  }
}

/** Finishes the OAuth flow and saves (or replaces) the person's connection */
export async function connectFromCode(
  user: { id: string; accountId: string },
  code: string,
  origin: string,
): Promise<{ ok: true; email: string | null } | { ok: false; error: 'no_refresh_token' | 'scope_denied' | 'exchange_failed' }> {
  const t = await tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: origin + CALLBACK_PATH })
  if (!t.access_token) {
    console.error('[calendar] code exchange failed:', t.error, t.error_description)
    return { ok: false, error: 'exchange_failed' }
  }
  // Google lets people untick the calendar permission on the consent screen
  if (!t.scope?.split(' ').includes(GOOGLE_CALENDAR_SCOPE)) return { ok: false, error: 'scope_denied' }
  if (!t.refresh_token) return { ok: false, error: 'no_refresh_token' }

  const email = emailFromIdToken(t.id_token)
  const values = {
    accountId: user.accountId,
    provider: 'google',
    externalEmail: email,
    refreshTokenCiphertext: encryptApiKey(t.refresh_token),
    scope: t.scope,
    updatedAt: new Date(),
  }
  const [old] = await db.select().from(calendarConnections).where(eq(calendarConnections.userId, user.id)).limit(1)
  await db.insert(calendarConnections).values({ userId: user.id, ...values })
    .onConflictDoUpdate({ target: calendarConnections.userId, set: values })
  // Reconnecting replaces the old grant; let Google forget it
  if (old) await revokeToken(old.refreshTokenCiphertext)
  return { ok: true, email }
}

export async function getConnection(userId: string) {
  const [row] = await db.select().from(calendarConnections).where(eq(calendarConnections.userId, userId)).limit(1)
  return row ?? null
}

async function revokeToken(ciphertext: string) {
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(decryptApiKey(ciphertext))}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
  } catch (err) {
    console.error('[calendar] revoke failed:', err) // best effort; the token is deleted here either way
  }
}

/** Removes the connection and revokes Google's grant. Safe to call when there is none. */
export async function disconnect(userId: string) {
  const [row] = await db.delete(calendarConnections).where(eq(calendarConnections.userId, userId)).returning()
  if (row && isGoogleCalendarConfigured()) await revokeToken(row.refreshTokenCiphertext)
}

/** For account deletion and member removal: every connection in an account (or one person in it) */
export async function disconnectAll(accountId: string, userId?: string) {
  const rows = await db
    .delete(calendarConnections)
    .where(userId ? and(eq(calendarConnections.accountId, accountId), eq(calendarConnections.userId, userId)) : eq(calendarConnections.accountId, accountId))
    .returning()
  if (isGoogleCalendarConfigured()) await Promise.all(rows.map(r => revokeToken(r.refreshTokenCiphertext)))
}

async function accessToken(userId: string): Promise<string> {
  const row = await getConnection(userId)
  if (!row) throw new CalendarNotConnectedError()
  const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: decryptApiKey(row.refreshTokenCiphertext) })
  if (t.access_token) return t.access_token
  // invalid_grant: revoked in the Google account, password changed, or expired. The token is dead.
  if (t.error === 'invalid_grant') {
    await db.delete(calendarConnections).where(eq(calendarConnections.userId, userId))
    throw new CalendarNotConnectedError('Google Calendar access has ended. Connect it again in Settings → Calendar.')
  }
  throw new Error(`Google token refresh failed: ${t.error ?? 'unknown'}`)
}

/** Events on the person's primary calendar overlapping [from, to) */
export async function listEvents(userId: string, from: Date, to: Date): Promise<GoogleEvent[]> {
  const token = await accessToken(userId)
  const q = new URLSearchParams({
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '100',
    fields: 'items(id,status,summary,location,hangoutLink,conferenceData(entryPoints(entryPointType)),start,end,eventType,attendees(email,self,responseStatus,resource))',
  })
  const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (r.status === 401 || r.status === 403) {
    throw new CalendarNotConnectedError('Benchtop can no longer read this calendar. Connect it again in Settings → Calendar.')
  }
  if (!r.ok) throw new Error(`Google Calendar returned ${r.status}`)
  const data = (await r.json()) as { items?: GoogleEvent[] }
  return data.items ?? []
}
