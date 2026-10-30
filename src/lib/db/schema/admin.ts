import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core'

// What people do in the app, for the platform admin's activity log. One row per change made through
// the API (see lib/activity.ts). account_id has no FK so rows can be read for an account being
// deleted; account deletion removes them with the rest of the account's data.
export const activityLog = pgTable('activity_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull(),
  userId: uuid('user_id').notNull(), // Supabase auth UID
  method: text('method').notNull(), // POST | PUT | PATCH | DELETE
  path: text('path').notNull(),
  // From the path, e.g. 'formulations' and its id
  entity: text('entity').notNull(),
  entityId: text('entity_id'),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('activity_log_account_at_idx').on(t.accountId, t.at),
  index('activity_log_user_at_idx').on(t.userId, t.at),
  index('activity_log_at_idx').on(t.at),
])

// Everything a platform admin does to an account or user. Kept after the account is deleted (no
// FK), with the account's name copied into `details`.
export const adminActions = pgTable('admin_actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  adminUserId: uuid('admin_user_id').notNull(),
  accountId: uuid('account_id'),
  targetUserId: uuid('target_user_id'),
  // e.g. 'plan.change', 'account.suspend', 'account.delete', 'subscription.cancel', 'user.suspend'
  action: text('action').notNull(),
  details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('admin_actions_account_at_idx').on(t.accountId, t.at),
  index('admin_actions_at_idx').on(t.at),
])
