import {
  pgTable, uuid, text, boolean, bigint, integer, jsonb, timestamp, index, primaryKey, check,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import type { MemberAccess } from '../../team-access'

// Fixed, well-known id of the account that owns all data that existed before multi-tenancy
// (the original LaunchTime staff workspace). Created by the 0007 migration; billing exempt.
export const LEGACY_ACCOUNT_ID = '00000000-0000-4000-8000-000000000001'

// Tenant. Every tenant-owned root row (projects, formulations, ingredients, suppliers, equipment,
// audit_log) carries an account_id; everything else is scoped through its parent.
export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  // Internal/legacy accounts are never gated on a subscription
  billingExempt: boolean('billing_exempt').notNull().default(false),
  // How the platform admin invited the account (see lib/billing/plans.ts):
  //   'paid'           subscribes after a free trial that ends at free_until
  //   'free_lifetime'  never needs a subscription
  //   'free_period'    free until free_until, then needs a subscription
  plan: text('plan').notNull().default('paid'),
  freeUntil: timestamp('free_until', { withTimezone: true }),
  // 'free_lifetime' only: most additional users (besides the owner) the account may have; null = no cap
  maxUsers: integer('max_users'),
  stripeCustomerId: text('stripe_customer_id').unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  check('accounts_plan_chk', sql`${t.plan} in ('paid', 'free_lifetime', 'free_period')`),
])

// Membership. One user belongs to exactly one account (user_id UNIQUE); every member besides the
// owner is a paid team seat. user_id is a Supabase auth uid with no FK to auth.users (the local
// Postgres may not have the auth schema).
export const accountMembers = pgTable('account_members', {
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().unique(),
  // 'owner' | 'admin' | 'member'. Owners and admins see and edit everything and manage the team.
  role: text('role').notNull().default('member'),
  // What a 'member' may see and edit (see lib/team-access.ts); ignored for owners and admins
  access: jsonb('access').$type<MemberAccess>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.accountId, t.userId] }),
  check('account_members_role_chk', sql`${t.role} in ('owner', 'admin', 'member')`),
  index('account_members_account_idx').on(t.accountId),
])

export const profiles = pgTable('profiles', {
  userId: uuid('user_id').primaryKey(),
  fullName: text('full_name'),
  company: text('company'),
  jobTitle: text('job_title'),
  phone: text('phone'),
  timezone: text('timezone'),
  isPlatformAdmin: boolean('is_platform_admin').notNull().default(false),
  termsVersion: text('terms_version'),
  termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true }),
  privacyVersion: text('privacy_version'),
  privacyAcceptedAt: timestamp('privacy_accepted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// Invitations. Only a SHA-256 hash of the token is stored; the plaintext link is shown once at
// creation. Status (pending/accepted/expired/revoked) is derived, not stored.
// Platform-admin invitations (account_id null) create a new account; team invitations
// (account_id set) add a member to that account with the given role and access.
export const invitations = pgTable('invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'cascade' }),
  role: text('role'), // team invitations only: 'admin' | 'member'
  access: jsonb('access').$type<MemberAccess>(),
  // New-account invitations only: the plan the account is created on, and for 'free_period' how
  // many days it stays free from signup
  plan: text('plan'),
  freeDays: integer('free_days'),
  maxUsers: integer('max_users'), // 'free_lifetime' only; copied to the new account
  email: text('email').notNull(), // stored lowercased
  tokenHash: text('token_hash').notNull().unique(),
  note: text('note'),
  invitedBy: uuid('invited_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  acceptedBy: uuid('accepted_by'),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (t) => [
  index('invitations_email_idx').on(t.email),
  index('invitations_account_idx').on(t.accountId),
])

// One row per account, mirrored from Stripe by webhook / checkout-return sync
export const subscriptions = pgTable('subscriptions', {
  accountId: uuid('account_id').primaryKey().references(() => accounts.id, { onDelete: 'cascade' }),
  stripeSubscriptionId: text('stripe_subscription_id'),
  status: text('status').notNull(),
  priceId: text('price_id'),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  // Quantity of the extra-team-seat item on the subscription (0 when it has none)
  seatQuantity: integer('seat_quantity').notNull().default(0),
  // Stripe `event.created` (unix seconds) of the newest event applied; older events are ignored
  lastEventCreated: bigint('last_event_created', { mode: 'number' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// Webhook idempotency: an event id is processed at most once
export const stripeEvents = pgTable('stripe_events', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
})
