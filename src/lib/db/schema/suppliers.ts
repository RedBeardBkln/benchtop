import {
  pgTable, uuid, text, numeric, boolean,
  timestamp, index,
} from 'drizzle-orm/pg-core'
import { ingredients } from './ingredients'

export const suppliers = pgTable('suppliers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  websiteUrl: text('website_url'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('suppliers_name_idx').on(t.name),
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
