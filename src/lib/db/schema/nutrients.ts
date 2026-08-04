import { pgTable, uuid, text, integer, numeric, timestamp, index } from 'drizzle-orm/pg-core'
import { nutrientCategoryEnum } from './enums'

export const nutrients = pgTable('nutrients', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  unit: text('unit').notNull(),
  // USDA FoodData Central nutrient number — maps USDA API responses to local rows
  fdcNutrientNumber: integer('fdc_nutrient_number'),
  // FDA 2020 Daily Value used for %DV calculations; null = no DV established
  dailyValueAmount: numeric('daily_value_amount', { precision: 12, scale: 6 }),
  category: nutrientCategoryEnum('category').notNull().default('other'),
  displayOrder: integer('display_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('nutrients_display_order_idx').on(t.displayOrder),
  index('nutrients_fdc_number_idx').on(t.fdcNutrientNumber),
])
