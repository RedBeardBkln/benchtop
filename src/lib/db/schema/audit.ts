import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { accounts } from './accounts'

// Append-only log of every mutation in the app
// entity: table name, entity_id: row id, action: insert|update|delete|lock|approve|override
export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  entity: text('entity').notNull(),
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(),
  before: jsonb('before'),
  after: jsonb('after'),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  userId: uuid('user_id'), // Supabase auth UID; null = system/seed
}, (t) => [
  index('audit_log_entity_idx').on(t.entity, t.entityId),
  index('audit_log_at_idx').on(t.at),
  index('audit_log_user_idx').on(t.userId),
  index('audit_log_account_idx').on(t.accountId),
])
