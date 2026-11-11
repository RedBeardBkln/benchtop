import { pgTable, uuid, text, timestamp, jsonb, index, integer, bigint, check } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

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

// Every account data export (Settings → Your data), for the platform admin to review: who exported,
// when, what (the format chosen for each part, or skipped), and whether it worked. No FK, like
// activity_log; account deletion removes the rows with the rest of the account's data.
export const dataExports = pgTable('data_exports', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull(),
  userId: uuid('user_id').notNull(), // Supabase auth UID of whoever exported
  // 'files': the zip of Excel / Word / PDF / image files; 'json': the one-file JSON download
  kind: text('kind').notNull(),
  // 'started' (recorded as it begins; one left 'started' never finished, e.g. the function timed out) | 'succeeded' | 'failed'
  status: text('status').notNull(),
  // 'files' only: the format chosen for each part of the export, or 'skip' (see lib/export/model.ts)
  choices: jsonb('choices').$type<Record<string, string>>(),
  // What went in: counts of records and files, documents left out or unreadable
  summary: jsonb('summary').$type<Record<string, number>>().notNull().default({}),
  bytes: bigint('bytes', { mode: 'number' }),
  durationMs: integer('duration_ms'),
  // A short description of what went wrong (first line only, never query parameters)
  error: text('error'),
  // 'files' only: where the zip was staged, and when the browser had it (it then removes the staged copy)
  stagedPath: text('staged_path'),
  downloadedAt: timestamp('downloaded_at', { withTimezone: true }),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
}, (t) => [
  index('data_exports_account_at_idx').on(t.accountId, t.at),
  index('data_exports_at_idx').on(t.at),
  check('data_exports_kind_chk', sql`${t.kind} in ('files', 'json')`),
  check('data_exports_status_chk', sql`${t.status} in ('started', 'succeeded', 'failed')`),
])
