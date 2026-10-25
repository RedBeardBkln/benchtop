import {
  pgTable, uuid, text, integer, numeric, boolean,
  timestamp, index, unique,
} from 'drizzle-orm/pg-core'
import { sourceTypeEnum, verificationEnum } from './enums'
import { nutrients } from './nutrients'
import { accounts } from './accounts'
import { formulations } from './formulations'
import { clients } from './clients'

export const ingredients = pgTable('ingredients', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  name: text('name').notNull(),
  sourceType: sourceTypeEnum('source_type').notNull().default('manual'),
  fdcId: integer('fdc_id'),
  fdcFetchedAt: timestamp('fdc_fetched_at', { withTimezone: true }),
  verification: verificationEnum('verification').notNull().default('unverified'),
  // Legacy: protein-isolate flags from an earlier workflow; no longer read or written by the app
  isAbSpi: boolean('is_ab_spi').notNull().default(false),
  isIsolateOrConcentrate: boolean('is_isolate_or_concentrate').notNull().default(false),
  naturallyDerived: boolean('naturally_derived').notNull().default(true),
  // Manually entered raw material cost, always stored per kg; cost_unit is the unit it's shown/entered in.
  // A supplier link marked use_for_cost overrides it (see lib/costing.ts).
  defaultCostPerKg: numeric('default_cost_per_kg', { precision: 10, scale: 4 }),
  costUnit: text('cost_unit').notNull().default('kg'),
  moisturePct: numeric('moisture_pct', { precision: 6, scale: 4 }),
  stockG: numeric('stock_g', { precision: 14, scale: 4 }),
  // Preferred name as it should appear on the ingredient deck
  labelName: text('label_name'),
  brandName: text('brand_name'),
  supplierName: text('supplier_name'),
  itemCode: text('item_code'),
  notes: text('notes'),
  // Library taxonomy, e.g. Starches > Tapioca > Native. Categories: the standard list plus any users add.
  category: text('category'),
  subcategory: text('subcategory'),
  microCategory: text('micro_category'),
  // Physically in the lab (set by the lab intake upload); formulation tools prefer these
  onHand: boolean('on_hand').notNull().default(false),
  // Set when this ingredient was saved from a finalized formulation (nutrients etc. are a snapshot of it)
  sourceFormulationId: uuid('source_formulation_id').references(() => formulations.id, { onDelete: 'set null' }),
  // Archived ingredients drop out of the library list and pickers but stay in the formulations that use them
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  // Set when archived along with a client
  archivedWithClientId: uuid('archived_with_client_id').references(() => clients.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('ingredients_account_idx').on(t.accountId),
  index('ingredients_name_idx').on(t.name),
  index('ingredients_fdc_id_idx').on(t.fdcId),
  index('ingredients_is_ab_spi_idx').on(t.isAbSpi),
  index('ingredients_source_formulation_idx').on(t.sourceFormulationId),
  index('ingredients_category_idx').on(t.category),
])

// Per-ingredient nutrient values — one row per (ingredient, nutrient) pair
export const ingredientNutrients = pgTable('ingredient_nutrients', {
  id: uuid('id').primaryKey().defaultRandom(),
  ingredientId: uuid('ingredient_id').notNull().references(() => ingredients.id, { onDelete: 'cascade' }),
  nutrientId: uuid('nutrient_id').notNull().references(() => nutrients.id, { onDelete: 'restrict' }),
  // Amount per 100 g of ingredient as-purchased; full precision stored, display rounds.
  // Precision 18 allows trace vitamins/minerals measured in mcg to reach into the billions.
  amountPer100g: numeric('amount_per_100g', { precision: 18, scale: 6 }).notNull(),
  // Human-readable source: USDA FDC ID, supplier doc filename, "user-entered", etc.
  sourceRef: text('source_ref').notNull(),
  sourceUrl: text('source_url'),
}, (t) => [
  unique('ingredient_nutrients_unique').on(t.ingredientId, t.nutrientId),
  index('ingredient_nutrients_ingredient_idx').on(t.ingredientId),
  index('ingredient_nutrients_nutrient_idx').on(t.nutrientId),
])

// Big-9 + sesame + gluten + custom:xxx
export const ingredientAllergens = pgTable('ingredient_allergens', {
  id: uuid('id').primaryKey().defaultRandom(),
  ingredientId: uuid('ingredient_id').notNull().references(() => ingredients.id, { onDelete: 'cascade' }),
  allergen: text('allergen').notNull(),
}, (t) => [
  unique('ingredient_allergens_unique').on(t.ingredientId, t.allergen),
  index('ingredient_allergens_ingredient_idx').on(t.ingredientId),
])

export const ingredientDocs = pgTable('ingredient_docs', {
  id: uuid('id').primaryKey().defaultRandom(),
  ingredientId: uuid('ingredient_id').notNull().references(() => ingredients.id, { onDelete: 'cascade' }),
  filePath: text('file_path').notNull(), // Supabase Storage path
  label: text('label').notNull(),        // e.g. "Spec Sheet", "COA 2024-01"
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('ingredient_docs_ingredient_idx').on(t.ingredientId),
])

export const ingredientCerts = pgTable('ingredient_certs', {
  id: uuid('id').primaryKey().defaultRandom(),
  ingredientId: uuid('ingredient_id').notNull().references(() => ingredients.id, { onDelete: 'cascade' }),
  // e.g. organic, non_gmo, kosher, halal, vegan, gluten_free, ip_non_gmo
  cert: text('cert').notNull(),
  evidenceDocId: uuid('evidence_doc_id').references(() => ingredientDocs.id, { onDelete: 'set null' }),
}, (t) => [
  unique('ingredient_certs_unique').on(t.ingredientId, t.cert),
  index('ingredient_certs_ingredient_idx').on(t.ingredientId),
])

// Declared sub-ingredient list for composite ingredients (e.g. "Soy Sauce (Water, Soybeans, …)")
export const subIngredients = pgTable('sub_ingredients', {
  id: uuid('id').primaryKey().defaultRandom(),
  ingredientId: uuid('ingredient_id').notNull().references(() => ingredients.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(), // 1-based display order
  name: text('name').notNull(),
}, (t) => [
  unique('sub_ingredients_unique').on(t.ingredientId, t.position),
  index('sub_ingredients_ingredient_idx').on(t.ingredientId),
])
