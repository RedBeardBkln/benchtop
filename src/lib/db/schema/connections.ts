import { pgTable, uuid, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { accounts } from './accounts'

// Keys an outside invoicing app uses to read a person's unbilled time and mark it billed (see
// lib/invoicing-connection.ts). Only a hash of the key is stored; the key itself is shown once.
// At most one live key per person: making a new one revokes the old.
export const invoicingConnections = pgTable('invoicing_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  userId: uuid('user_id').notNull(), // Supabase auth UID; the key acts as this person
  keyHash: text('key_hash').notNull(), // sha256 hex
  keyLast4: text('key_last4').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (t) => [
  uniqueIndex('invoicing_connections_key_hash_uq').on(t.keyHash),
  uniqueIndex('invoicing_connections_one_live_uq').on(t.userId).where(sql`${t.revokedAt} is null`),
  index('invoicing_connections_account_idx').on(t.accountId),
])
