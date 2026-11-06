import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core'

// Beta invitation requests sent from the public site (/request-invite). Nobody is signed in, so
// there is no account or user. A platform admin reviews them on /admin/invitations; creating an
// invitation for the same email marks the request invited.
export const inviteRequests = pgTable('invite_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull(), // lowercased
  company: text('company'),
  role: text('role'),
  companyType: text('company_type'), // see INVITE_COMPANY_TYPES in lib/invite-requests.ts
  teamSize: text('team_size'),
  message: text('message'),
  referral: text('referral'),
  status: text('status').notNull().default('new'), // 'new' | 'invited' | 'declined'
  // SHA-256 of the sender's IP, only for rate limiting
  ipHash: text('ip_hash'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
}, (t) => [
  index('invite_requests_created_idx').on(t.createdAt),
  index('invite_requests_email_idx').on(t.email),
])
