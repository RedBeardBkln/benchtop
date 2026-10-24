import { pgTable, uuid, text, timestamp, boolean, index } from 'drizzle-orm/pg-core'
import { accounts } from './accounts'

// Bug reports and feature requests sent from the "Send feedback" link at the foot of every page.
// Contact details are copied at submission (the sender can edit them in the dialog), so a later
// profile change doesn't rewrite what was sent. Read by platform admins at /admin/feedback.
export const feedback = pgTable('feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(), // Supabase auth UID
  kind: text('kind').notNull(), // 'bug' | 'feature'
  message: text('message').notNull(),
  contactName: text('contact_name').notNull(),
  contactEmail: text('contact_email').notNull(),
  contactPhone: text('contact_phone'),
  wantsContact: boolean('wants_contact').notNull().default(false),
  // Page the link was clicked on, and the browser, to help reproduce bugs
  pagePath: text('page_path'),
  userAgent: text('user_agent'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('feedback_created_idx').on(t.createdAt),
])
