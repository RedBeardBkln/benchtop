/**
 * Database seed script — run with: pnpm db:seed
 * Seeds the nutrients table only; all other data is user-created at runtime.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq } from 'drizzle-orm'
import * as schema from './schema'
import { NUTRIENT_SEEDS } from './seeds/nutrients'

async function seed() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false })
  const db = drizzle(client, { schema })

  console.log('Seeding nutrients…')

  let inserted = 0
  let skipped = 0

  for (const n of NUTRIENT_SEEDS) {
    const existing = await db
      .select({ id: schema.nutrients.id })
      .from(schema.nutrients)
      .where(eq(schema.nutrients.name, n.name))
      .limit(1)

    if (existing.length > 0) {
      skipped++
      continue
    }

    await db.insert(schema.nutrients).values({
      name: n.name,
      unit: n.unit,
      fdcNutrientNumber: n.fdcNutrientNumber,
      dailyValueAmount: n.dailyValueAmount,
      category: n.category,
      displayOrder: n.displayOrder,
    })
    inserted++
  }

  console.log(`Done — inserted: ${inserted}, skipped (already exist): ${skipped}`)
  await client.end()
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
