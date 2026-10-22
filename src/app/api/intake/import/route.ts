import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { ingredients, intakeItems } from '@/lib/db/schema'
import { findDuplicate } from '@/lib/ingredient-duplicates'
import { identityKey, normalizePart } from '@/lib/ingredient-identity'
import { quantityToGrams } from '@/lib/ingredient-categories'
import { formatIngredientName } from '@/lib/ingredient-name'

const bodySchema = z.object({
  // Upload only these entries; omitted = every identified entry
  ids: z.array(z.string().uuid()).max(1000).optional(),
})

// Uploads identified intake entries into the ingredient library, marked on hand. An entry matched to an
// existing ingredient (by Claude, by the user, or by the duplicate rule) updates that ingredient instead
// of creating a second one; its category is only filled in where the ingredient has none.
export async function POST(request: NextRequest) {
  const auth = await requireApi({ libraryEdit: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth
  const accountId = ctx.account.id

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const items = await db
    .select()
    .from(intakeItems)
    .where(and(
      eq(intakeItems.accountId, accountId),
      eq(intakeItems.status, 'identified'),
      parsed.data.ids ? inArray(intakeItems.id, parsed.data.ids) : undefined,
    ))
    .orderBy(intakeItems.createdAt)
  if (items.length === 0) return NextResponse.json({ error: 'Nothing identified to upload yet' }, { status: 400 })

  try {
    const result = await db.transaction(async tx => {
      let created = 0
      let linked = 0
      // Several jars of one material add up; only mass amounts become stock (grams)
      const stockById = new Map<string, number>()
      // Entries created earlier in this upload aren't visible to findDuplicate (it reads outside the transaction)
      const createdByKey = new Map<string, string>()

      for (const item of items) {
        const name = formatIngredientName(item.name || item.rawName)
        const qty = item.quantity != null ? parseFloat(item.quantity) : null
        const grams = qty != null && item.quantityUnit ? quantityToGrams(qty, item.quantityUnit) : null
        const otherQty = qty != null && item.quantityUnit && grams == null ? `${qty} ${item.quantityUnit}` : null

        let targetId: string | null = null
        if (item.matchedIngredientId) {
          const [own] = await tx
            .select({ id: ingredients.id })
            .from(ingredients)
            .where(and(eq(ingredients.id, item.matchedIngredientId), eq(ingredients.accountId, accountId)))
          targetId = own?.id ?? null
        }
        const identity = { name, brandName: null, supplierName: null, itemCode: null }
        targetId ??= createdByKey.get(identityKey(identity)) ?? (await findDuplicate(accountId, identity))?.id ?? null

        if (targetId) {
          const [current] = await tx.select().from(ingredients).where(eq(ingredients.id, targetId))
          const takeCategory = !current.category
          await tx
            .update(ingredients)
            .set({
              onHand: true,
              category: takeCategory ? item.category : current.category,
              subcategory: takeCategory ? item.subcategory : current.subcategory,
              microCategory: takeCategory ? item.microCategory : current.microCategory,
              notes: otherQty ? appendNote(current.notes, `On hand: ${otherQty}`) : current.notes,
              updatedAt: new Date(),
            })
            .where(eq(ingredients.id, targetId))
          linked++
        } else {
          const [row] = await tx
            .insert(ingredients)
            .values({
              accountId,
              name,
              sourceType: 'manual',
              verification: 'unverified',
              labelName: normalizePart(item.rawName) !== normalizePart(name) ? item.rawName : null,
              category: item.category,
              subcategory: item.subcategory,
              microCategory: item.microCategory,
              onHand: true,
              notes: [item.aiNotes, otherQty ? `On hand: ${otherQty}` : null].filter(Boolean).join('\n') || null,
            })
            .returning({ id: ingredients.id })
          targetId = row.id
          createdByKey.set(identityKey(identity), row.id)
          created++
        }

        if (grams != null) stockById.set(targetId, (stockById.get(targetId) ?? 0) + grams)
        await tx
          .update(intakeItems)
          .set({ status: 'imported', importedIngredientId: targetId, updatedAt: new Date() })
          .where(eq(intakeItems.id, item.id))
      }

      // A shelf count replaces whatever stock was recorded before
      for (const [id, grams] of stockById) {
        await tx.update(ingredients).set({ stockG: grams.toFixed(4) }).where(eq(ingredients.id, id))
      }
      return { created, linked }
    })
    return NextResponse.json(result)
  } catch (err) {
    console.error('POST /api/intake/import error:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

function appendNote(notes: string | null, line: string) {
  return notes?.includes(line) ? notes : [notes, line].filter(Boolean).join('\n')
}
