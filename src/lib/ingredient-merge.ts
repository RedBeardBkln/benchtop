import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  auditLog, formulationLines, ingredientAllergens, ingredientCerts, ingredientDocs, ingredientNutrients,
  ingredientSuppliers, ingredients, reverseCandidates, subIngredients,
} from '@/lib/db/schema'

// Merge ingredient `sourceId` INTO `targetId` (the one that is kept). Everything that pointed at the
// source is re-pointed at the target and the source row is deleted — all in one transaction, so a
// failure leaves both ingredients exactly as they were.
//
// Rules (the target's own data always wins; the source only fills gaps):
//  - formulation lines / reverse candidates -> re-pointed. A formulation that used BOTH ingredients
//    gets one combined line (weights and % added) so no formulation ends up listing it twice.
//  - nutrient values -> target keeps its own; nutrients it lacks are copied from the source.
//  - allergens -> union (never silently drop an allergen).
//  - documents -> moved. Certifications -> moved unless the target already has that cert.
//  - supplier links -> moved unless the target already has that supplier.
//  - sub-ingredient declaration -> moved only if the target has none.
//  - stock -> added together. Cost, moisture, label name -> copied only if the target has none.
//  - name / brand / supplier / item code are NEVER copied (they define identity; copying could create
//    a new duplicate).

export type MergeSummary = {
  keptId: string
  removedId: string
  formulationLinesMoved: number
  formulationLinesCombined: number
  nutrientsCopied: number
  allergensAdded: number
  docsMoved: number
  supplierLinksMoved: number
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

const num = (v: string | null | undefined) => (v == null ? null : parseFloat(v))

export async function mergeIngredients(opts: {
  accountId: string
  userId: string
  sourceId: string
  targetId: string
}): Promise<MergeSummary> {
  const { accountId, userId, sourceId, targetId } = opts
  if (sourceId === targetId) throw new Error('Cannot merge an ingredient into itself')

  return db.transaction(async (tx: Tx) => {
    const [source] = await tx.select().from(ingredients)
      .where(and(eq(ingredients.id, sourceId), eq(ingredients.accountId, accountId))).limit(1)
    const [target] = await tx.select().from(ingredients)
      .where(and(eq(ingredients.id, targetId), eq(ingredients.accountId, accountId))).limit(1)
    if (!source || !target) throw new Error('Ingredient not found')

    // ── formulation lines ──
    const sourceLines = await tx.select().from(formulationLines).where(eq(formulationLines.ingredientId, sourceId))
    const targetLines = sourceLines.length === 0 ? [] : await tx.select().from(formulationLines).where(and(
      eq(formulationLines.ingredientId, targetId),
      inArray(formulationLines.formulationId, [...new Set(sourceLines.map(l => l.formulationId))]),
    ))
    const targetLineByFormulation = new Map(targetLines.map(l => [l.formulationId, l]))
    let linesMoved = 0
    let linesCombined = 0
    for (const sl of sourceLines) {
      const tl = targetLineByFormulation.get(sl.formulationId)
      if (tl) {
        await tx.update(formulationLines).set({
          weightG: String((num(tl.weightG) ?? 0) + (num(sl.weightG) ?? 0)),
          pct: String((num(tl.pct) ?? 0) + (num(sl.pct) ?? 0)),
          locked: tl.locked || sl.locked,
          pctLocked: tl.pctLocked || sl.pctLocked,
        }).where(eq(formulationLines.id, tl.id))
        await tx.delete(formulationLines).where(eq(formulationLines.id, sl.id))
        linesCombined++
      } else {
        await tx.update(formulationLines).set({ ingredientId: targetId }).where(eq(formulationLines.id, sl.id))
        linesMoved++
      }
    }

    await tx.update(reverseCandidates).set({ candidateIngredientId: targetId })
      .where(eq(reverseCandidates.candidateIngredientId, sourceId))

    // ── nutrients: fill gaps ──
    const targetNutrientIds = new Set(
      (await tx.select({ n: ingredientNutrients.nutrientId }).from(ingredientNutrients)
        .where(eq(ingredientNutrients.ingredientId, targetId))).map(r => r.n),
    )
    const sourceNutrients = await tx.select().from(ingredientNutrients).where(eq(ingredientNutrients.ingredientId, sourceId))
    const toCopy = sourceNutrients.filter(n => !targetNutrientIds.has(n.nutrientId))
    if (toCopy.length > 0) {
      await tx.insert(ingredientNutrients).values(toCopy.map(n => ({
        ingredientId: targetId,
        nutrientId: n.nutrientId,
        amountPer100g: n.amountPer100g,
        sourceRef: `${n.sourceRef} (merged from "${source.name}")`.slice(0, 500),
        sourceUrl: n.sourceUrl,
      })))
    }

    // ── allergens: union ──
    const sourceAllergens = await tx.select().from(ingredientAllergens).where(eq(ingredientAllergens.ingredientId, sourceId))
    const targetAllergens = new Set(
      (await tx.select({ a: ingredientAllergens.allergen }).from(ingredientAllergens)
        .where(eq(ingredientAllergens.ingredientId, targetId))).map(r => r.a),
    )
    const newAllergens = sourceAllergens.filter(a => !targetAllergens.has(a.allergen))
    if (newAllergens.length > 0) {
      await tx.insert(ingredientAllergens)
        .values(newAllergens.map(a => ({ ingredientId: targetId, allergen: a.allergen })))
        .onConflictDoNothing()
    }

    // ── documents and certifications ──
    const docs = await tx.update(ingredientDocs).set({ ingredientId: targetId })
      .where(eq(ingredientDocs.ingredientId, sourceId)).returning({ id: ingredientDocs.id })
    const targetCerts = new Set(
      (await tx.select({ c: ingredientCerts.cert }).from(ingredientCerts)
        .where(eq(ingredientCerts.ingredientId, targetId))).map(r => r.c),
    )
    const sourceCerts = await tx.select().from(ingredientCerts).where(eq(ingredientCerts.ingredientId, sourceId))
    for (const c of sourceCerts) {
      if (targetCerts.has(c.cert)) await tx.delete(ingredientCerts).where(eq(ingredientCerts.id, c.id))
      else await tx.update(ingredientCerts).set({ ingredientId: targetId }).where(eq(ingredientCerts.id, c.id))
    }

    // ── supplier links ──
    const targetLinks = await tx.select().from(ingredientSuppliers).where(eq(ingredientSuppliers.ingredientId, targetId))
    const targetSupplierIds = new Set(targetLinks.map(l => l.supplierId))
    const targetHasPreferred = targetLinks.some(l => l.isPreferred)
    const sourceLinks = await tx.select().from(ingredientSuppliers).where(eq(ingredientSuppliers.ingredientId, sourceId))
    let linksMoved = 0
    for (const l of sourceLinks) {
      if (targetSupplierIds.has(l.supplierId)) {
        await tx.delete(ingredientSuppliers).where(eq(ingredientSuppliers.id, l.id))
      } else {
        await tx.update(ingredientSuppliers).set({
          ingredientId: targetId,
          isPreferred: l.isPreferred && !targetHasPreferred,
        }).where(eq(ingredientSuppliers.id, l.id))
        linksMoved++
      }
    }

    // ── sub-ingredient declaration ──
    const targetSubs = await tx.select({ id: subIngredients.id }).from(subIngredients)
      .where(eq(subIngredients.ingredientId, targetId)).limit(1)
    if (targetSubs.length === 0) {
      await tx.update(subIngredients).set({ ingredientId: targetId }).where(eq(subIngredients.ingredientId, sourceId))
    }

    // ── scalar fields ──
    const stockSum = (num(target.stockG) ?? 0) + (num(source.stockG) ?? 0)
    const notes = source.notes && source.notes !== target.notes
      ? [target.notes, `Merged from "${source.name}": ${source.notes}`].filter(Boolean).join('\n\n').slice(0, 2000)
      : target.notes
    await tx.update(ingredients).set({
      stockG: target.stockG == null && source.stockG == null ? null : String(stockSum),
      defaultCostPerKg: target.defaultCostPerKg ?? source.defaultCostPerKg,
      moisturePct: target.moisturePct ?? source.moisturePct,
      labelName: target.labelName ?? source.labelName,
      fdcId: target.fdcId ?? source.fdcId,
      fdcFetchedAt: target.fdcId == null && source.fdcId != null ? source.fdcFetchedAt : target.fdcFetchedAt,
      // Keep a link to the formulation this was saved from, so "update the saved ingredient" still works
      sourceFormulationId: target.sourceFormulationId ?? source.sourceFormulationId,
      notes,
      updatedAt: new Date(),
    }).where(eq(ingredients.id, targetId))

    // Everything that referenced the source has been re-pointed; remaining children cascade away with it
    await tx.delete(ingredients).where(and(eq(ingredients.id, sourceId), eq(ingredients.accountId, accountId)))

    const summary: MergeSummary = {
      keptId: targetId,
      removedId: sourceId,
      formulationLinesMoved: linesMoved,
      formulationLinesCombined: linesCombined,
      nutrientsCopied: toCopy.length,
      allergensAdded: newAllergens.length,
      docsMoved: docs.length,
      supplierLinksMoved: linksMoved,
    }

    await tx.insert(auditLog).values({
      accountId,
      entity: 'ingredients',
      entityId: targetId,
      action: 'merge',
      before: {
        removed: {
          id: source.id, name: source.name, brandName: source.brandName,
          supplierName: source.supplierName, itemCode: source.itemCode,
        },
      },
      after: summary,
      userId,
    })

    return summary
  })
}
