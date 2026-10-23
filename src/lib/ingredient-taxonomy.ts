import { db } from '@/lib/db'
import { ingredients, intakeItems } from '@/lib/db/schema'
import { and, eq, isNotNull, or } from 'drizzle-orm'
import type { TaxonomyEntry } from '@/lib/ingredient-categories'

/** Every category/subcategory/micro category combination saved on the account's ingredients or intake list. */
export async function loadTaxonomyEntries(accountId: string): Promise<TaxonomyEntry[]> {
  const [lib, intake] = await Promise.all([
    db
      .selectDistinct({ category: ingredients.category, subcategory: ingredients.subcategory, microCategory: ingredients.microCategory })
      .from(ingredients)
      .where(and(
        eq(ingredients.accountId, accountId),
        or(isNotNull(ingredients.category), isNotNull(ingredients.subcategory), isNotNull(ingredients.microCategory)),
      )),
    db
      .selectDistinct({ category: intakeItems.category, subcategory: intakeItems.subcategory, microCategory: intakeItems.microCategory })
      .from(intakeItems)
      .where(and(
        eq(intakeItems.accountId, accountId),
        or(isNotNull(intakeItems.category), isNotNull(intakeItems.subcategory), isNotNull(intakeItems.microCategory)),
      )),
  ])
  return [...lib, ...intake]
}
