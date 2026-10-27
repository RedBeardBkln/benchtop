import { pgTable, uuid, text, boolean, timestamp, index, uniqueIndex, check } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { accounts } from './accounts'
import { clients } from './clients'
import { projects } from './projects'

// Billable time logged against a client, optionally one of its projects (see lib/time-tracking.ts).
// Each entry belongs to the person who logged it; owners and admins can see and change everyone's.
// ended_at null = a running timer, at most one per person.
export const timeEntries = pgTable('time_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  userId: uuid('user_id').notNull(), // Supabase auth UID
  // Deleting a client with logged time is refused (billing history), so no cascade
  clientId: uuid('client_id').notNull().references(() => clients.id),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  activity: text('activity').notNull(), // a TIME_ACTIVITIES key
  task: text('task').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  billed: boolean('billed').notNull().default(false),
  billedAt: timestamp('billed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('time_entries_account_started_idx').on(t.accountId, t.startedAt),
  index('time_entries_client_idx').on(t.clientId),
  index('time_entries_project_idx').on(t.projectId),
  uniqueIndex('time_entries_one_running_uq').on(t.userId).where(sql`${t.endedAt} is null`),
  check('time_entries_span_chk', sql`${t.endedAt} is null or ${t.endedAt} > ${t.startedAt}`),
])
