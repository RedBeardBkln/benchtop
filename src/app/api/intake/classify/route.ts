import { NextRequest, NextResponse } from 'next/server'
import { formatIngredientName } from '@/lib/ingredient-name'
import { and, eq, inArray, isNotNull, ne, sql } from 'drizzle-orm'
import { z } from 'zod'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { ingredients, intakeItems } from '@/lib/db/schema'
import { AiRefusalError, claudeJson } from '@/lib/ai-json'
import {
  INGREDIENT_CATEGORIES, SUBCATEGORY_EXAMPLES, categoryPath, isIngredientCategory,
} from '@/lib/ingredient-categories'

// Opus on a full batch can take a minute or two; the client calls this repeatedly until nothing is pending.
export const maxDuration = 300

const BATCH = 40

const bodySchema = z.object({
  // Re-identify these entries (any status except imported); omitted = the next batch of pending ones
  ids: z.array(z.string().uuid()).max(BATCH).optional(),
})

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'name', 'category', 'subcategory', 'microCategory', 'confidence', 'notes', 'libraryMatchId'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          category: { type: 'string', enum: [...INGREDIENT_CATEGORIES] },
          subcategory: { type: 'string' },
          microCategory: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          notes: { type: 'string' },
          libraryMatchId: { type: 'string' },
        },
      },
    },
  },
}

type Classified = {
  id: string; name: string; category: string; subcategory: string; microCategory: string
  confidence: 'high' | 'medium' | 'low'; notes: string; libraryMatchId: string
}

export async function POST(request: NextRequest) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth
  const accountId = ctx.account.id

  if (!process.env.ANTHROPIC_API_KEY)
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  const { ids } = parsed.data

  const batch = await db
    .select({ id: intakeItems.id, rawName: intakeItems.rawName })
    .from(intakeItems)
    .where(and(
      eq(intakeItems.accountId, accountId),
      ids ? and(inArray(intakeItems.id, ids), ne(intakeItems.status, 'imported')) : eq(intakeItems.status, 'pending'),
    ))
    .orderBy(intakeItems.createdAt)
    .limit(BATCH)
  if (batch.length === 0) return NextResponse.json({ classified: 0, remaining: 0 })

  // The library (to spot materials already in it) and the subcategories already in use (to stay consistent)
  const [library, usedPaths] = await Promise.all([
    db
      .select({
        id: ingredients.id, name: ingredients.name, brandName: ingredients.brandName,
        category: ingredients.category, subcategory: ingredients.subcategory, microCategory: ingredients.microCategory,
      })
      .from(ingredients)
      .where(eq(ingredients.accountId, accountId)),
    db
      .selectDistinct({ category: intakeItems.category, subcategory: intakeItems.subcategory, microCategory: intakeItems.microCategory })
      .from(intakeItems)
      .where(and(eq(intakeItems.accountId, accountId), isNotNull(intakeItems.category))),
  ])
  const taxonomy = new Set<string>()
  for (const r of [...library, ...usedPaths]) if (r.category) taxonomy.add(categoryPath(r))

  const categoryGuide = INGREDIENT_CATEGORIES
    .map(c => `- ${c}${SUBCATEGORY_EXAMPLES[c].length ? ` (e.g. ${SUBCATEGORY_EXAMPLES[c].join(', ')})` : ''}`)
    .join('\n')
  const libraryList = library
    .map(l => `${l.id} | ${l.name}${l.brandName ? ` (${l.brandName})` : ''}`)
    .join('\n') || '(empty)'

  const prompt = `You are a food scientist cataloguing the ingredient shelves of a food R&D lab. Most materials were repackaged, so all you have is the name written on each container's label. For every item below, identify the material and file it in the lab's ingredient library.

For each item return:
- name: the clean, standard name of the material as a formulator would write it (e.g. label "tapioca strch" → "Tapioca Starch"; "SF lecithin liq" → "Sunflower Lecithin, Liquid"). Keep grades, percentages and codes that matter (DE, mesh, bloom, % protein, "90").
- category: exactly one of the categories listed below, chosen by the material's main function in a formulation.
- subcategory: the material type or source within that category (e.g. Tapioca, Sunflower Lecithin, Xanthan, Whey).
- microCategory: the form, grade or treatment when it matters (e.g. Native, Pregelatinized, Liquid, Powder, Isolate, 80% Concentrate, Organic). Use "" when nothing further distinguishes it.
- confidence: high if the label clearly names one material; medium if you had to interpret an abbreviation or a likely variant; low if it is a guess.
- notes: one short sentence only when something needs checking (ambiguous label, could be several materials, likely misspelling). Otherwise "".
- libraryMatchId: the id from the EXISTING LIBRARY below if that entry is the same material (same type and form, ignoring brand); otherwise "".

Examples: "Tapioca starch" → Starches › Tapioca › Native. "Sunflower lecithin liquid" → Emulsifiers › Sunflower Lecithin › Liquid. "Xanthan" → Hydrocolloids & Gums › Xanthan › "". "Allulose" → Sweeteners › Rare Sugars › "".

CATEGORIES:
${categoryGuide}

${taxonomy.size ? `PATHS ALREADY IN USE — reuse these exact spellings when they fit:\n${[...taxonomy].sort().join('\n')}\n\n` : ''}EXISTING LIBRARY (id | name):
${libraryList}

ITEMS TO IDENTIFY (id | label text):
${batch.map(b => `${b.id} | ${b.rawName}`).join('\n')}

Return one entry per item, using its id.`

  try {
    const result = await claudeJson<{ items: Classified[] }>({ content: prompt, schema, effort: 'medium' })

    const batchIds = new Set(batch.map(b => b.id))
    const libraryIds = new Set(library.map(l => l.id))
    const clean = (s: string, max: number) => s.trim().slice(0, max) || null
    let classified = 0
    for (const c of result.items) {
      if (!batchIds.has(c.id) || !isIngredientCategory(c.category)) continue
      batchIds.delete(c.id) // one update per item even if Claude repeats an id
      await db
        .update(intakeItems)
        .set({
          status: 'identified',
          name: clean(formatIngredientName(c.name), 255),
          category: c.category,
          subcategory: clean(c.subcategory, 120),
          microCategory: clean(c.microCategory, 120),
          confidence: c.confidence,
          aiNotes: clean(c.notes, 500),
          matchedIngredientId: libraryIds.has(c.libraryMatchId) ? c.libraryMatchId : null,
          updatedAt: new Date(),
        })
        .where(and(eq(intakeItems.id, c.id), eq(intakeItems.accountId, accountId)))
      classified++
    }

    const [{ remaining }] = await db
      .select({ remaining: sql<number>`count(*)::int` })
      .from(intakeItems)
      .where(and(eq(intakeItems.accountId, accountId), eq(intakeItems.status, 'pending')))
    // Items Claude skipped stay pending; report them so the client doesn't loop on them forever
    return NextResponse.json({ classified, skipped: batchIds.size, remaining })
  } catch (err) {
    if (err instanceof AiRefusalError) return NextResponse.json({ error: err.message }, { status: 422 })
    console.error('[intake/classify]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Identification failed' }, { status: 500 })
  }
}
