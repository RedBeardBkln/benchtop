import {
  pgTable, uuid, text, numeric, boolean, integer,
  timestamp, index, jsonb,
} from 'drizzle-orm/pg-core'
import { ingredients } from './ingredients'
import { accounts } from './accounts'
import type { ClientAddress } from '../../client-schemas'

export const suppliers = pgTable('suppliers', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  name: text('name').notNull(),
  websiteUrl: text('website_url'),
  // The supplier's main line; individual people go in supplier_contacts
  email: text('email'),
  phone: text('phone'),
  address: jsonb('address').$type<ClientAddress>(),
  // Our customer number with them, quoted on POs
  accountNumber: text('account_number'),
  paymentTerms: text('payment_terms'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('suppliers_account_idx').on(t.accountId),
  index('suppliers_name_idx').on(t.name),
])

export const supplierContacts = pgTable('supplier_contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  supplierId: uuid('supplier_id').notNull().references(() => suppliers.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  title: text('title'),
  email: text('email'),
  phone: text('phone'),
  isPrimary: boolean('is_primary').notNull().default(false),
  notes: text('notes'),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('supplier_contacts_supplier_idx').on(t.supplierId),
])

export const ingredientSuppliers = pgTable('ingredient_suppliers', {
  id: uuid('id').primaryKey().defaultRandom(),
  ingredientId: uuid('ingredient_id').notNull().references(() => ingredients.id, { onDelete: 'cascade' }),
  supplierId: uuid('supplier_id').notNull().references(() => suppliers.id, { onDelete: 'cascade' }),
  packSize: numeric('pack_size', { precision: 10, scale: 4 }),
  packUnit: text('pack_unit'),
  costPerUnit: numeric('cost_per_unit', { precision: 10, scale: 4 }),
  isPreferred: boolean('is_preferred').notNull().default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('ingredient_suppliers_ingredient_idx').on(t.ingredientId),
  index('ingredient_suppliers_supplier_idx').on(t.supplierId),
])
