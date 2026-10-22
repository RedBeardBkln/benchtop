import { pgTable, uuid, text, boolean, integer, timestamp, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { accounts } from './accounts'
import type { ClientAddress, CarrierAccount } from '../../client-schemas'

// The account's customers. Projects link to one (projects.client_id); projects.client keeps a copy of
// the name because team access grants match projects by client name.
export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  name: text('name').notNull(),
  website: text('website'),
  notes: text('notes'),
  // Accounting
  legalName: text('legal_name'),
  taxId: text('tax_id'),
  paymentTerms: text('payment_terms'),
  currency: text('currency'),
  poRequired: boolean('po_required').notNull().default(false),
  billingEmail: text('billing_email'),
  billingAddress: jsonb('billing_address').$type<ClientAddress>(),
  accountingNotes: text('accounting_notes'),
  // Shipping
  shippingAddress: jsonb('shipping_address').$type<ClientAddress>(),
  upsAccount: text('ups_account'),
  fedexAccount: text('fedex_account'),
  dhlAccount: text('dhl_account'),
  otherCarrierAccounts: jsonb('other_carrier_accounts').$type<CarrierAccount[]>().notNull().default([]),
  preferredCarrier: text('preferred_carrier'),
  shippingNotes: text('shipping_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('clients_account_idx').on(t.accountId),
  // Names are unique per account (case-insensitive): the project dropdown and team access rely on it
  uniqueIndex('clients_account_name_uq').on(t.accountId, sql`lower(${t.name})`),
])

export const clientContacts = pgTable('client_contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  title: text('title'),
  email: text('email'),
  phone: text('phone'),
  isPrimary: boolean('is_primary').notNull().default(false),
  notes: text('notes'),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('client_contacts_client_idx').on(t.clientId),
])
