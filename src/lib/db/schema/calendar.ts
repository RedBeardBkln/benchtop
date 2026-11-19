import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core'
import { accounts } from './accounts'

// A person's connected Google Calendar, read by the time log to offer their meetings (see
// lib/calendar/google.ts). One per person. Only the refresh token is kept, encrypted like the
// team AI keys (lib/ai/key-crypto.ts); access tokens are fetched as needed and never stored.
export const calendarConnections = pgTable('calendar_connections', {
  userId: uuid('user_id').primaryKey(), // Supabase auth UID
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(), // 'google'
  // The Google account the calendar belongs to, shown in Settings
  externalEmail: text('external_email'),
  refreshTokenCiphertext: text('refresh_token_ciphertext').notNull(),
  scope: text('scope').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('calendar_connections_account_idx').on(t.accountId),
])
