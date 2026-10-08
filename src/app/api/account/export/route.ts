import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import {
  accountMembers, batchRuns, equipment, formulationLines, formulationNfpPanels, formulations, formulationTargets,
  ingredientAllergens, ingredientCerts, ingredientDocs, ingredientNutrients, ingredientSuppliers,
  ingredients, nutrients, processSteps, profiles, projects, reverseCandidates, reverseTargets,
  subIngredients, suppliers,
} from '@/lib/db/schema'

// Full JSON export of the caller's account. Owner only. Stays available without an active
// subscription (people must be able to get their data out). Every query is anchored to the
// account's root rows, so no other account's rows can appear.

export async function GET() {
  const auth = await requireApi({ allowUnentitled: true, role: 'owner' })
  if (!auth.ok) return auth.res
  const { ctx } = auth
  const accountId = ctx.account.id

  const [
    projectRows, formulationRows, ingredientRows, supplierRows, equipmentRows, memberRows,
  ] = await Promise.all([
    db.select().from(projects).where(eq(projects.accountId, accountId)),
    db.select().from(formulations).where(eq(formulations.accountId, accountId)),
    db.select().from(ingredients).where(eq(ingredients.accountId, accountId)),
    db.select().from(suppliers).where(eq(suppliers.accountId, accountId)),
    db.select().from(equipment).where(eq(equipment.accountId, accountId)),
    db
      .select({ userId: accountMembers.userId, role: accountMembers.role, fullName: profiles.fullName })
      .from(accountMembers)
      .leftJoin(profiles, eq(profiles.userId, accountMembers.userId))
      .where(eq(accountMembers.accountId, accountId)),
  ])

  const [
    lineRows, stepRows, targetRows, runRows, reverseTargetRows, reverseCandidateRows,
    nutrientRows, allergenRows, certRows, subIngredientRows, docRows, supplierLinkRows, nfpPanelRows,
  ] = await Promise.all([
    db.select({ r: formulationLines }).from(formulationLines)
      .innerJoin(formulations, eq(formulationLines.formulationId, formulations.id))
      .where(eq(formulations.accountId, accountId)),
    db.select({ r: processSteps }).from(processSteps)
      .innerJoin(formulations, eq(processSteps.formulationId, formulations.id))
      .where(eq(formulations.accountId, accountId)),
    db.select({ r: formulationTargets }).from(formulationTargets)
      .innerJoin(formulations, eq(formulationTargets.formulationId, formulations.id))
      .where(eq(formulations.accountId, accountId)),
    db.select({ r: batchRuns }).from(batchRuns)
      .innerJoin(formulations, eq(batchRuns.formulationId, formulations.id))
      .where(eq(formulations.accountId, accountId)),
    db.select({ r: reverseTargets }).from(reverseTargets)
      .innerJoin(projects, eq(reverseTargets.projectId, projects.id))
      .where(eq(projects.accountId, accountId)),
    db.select({ r: reverseCandidates }).from(reverseCandidates)
      .innerJoin(reverseTargets, eq(reverseCandidates.reverseTargetId, reverseTargets.id))
      .innerJoin(projects, eq(reverseTargets.projectId, projects.id))
      .where(eq(projects.accountId, accountId)),
    db.select({ r: ingredientNutrients, nutrientName: nutrients.name, nutrientUnit: nutrients.unit })
      .from(ingredientNutrients)
      .innerJoin(ingredients, eq(ingredientNutrients.ingredientId, ingredients.id))
      .innerJoin(nutrients, eq(ingredientNutrients.nutrientId, nutrients.id))
      .where(eq(ingredients.accountId, accountId)),
    db.select({ r: ingredientAllergens }).from(ingredientAllergens)
      .innerJoin(ingredients, eq(ingredientAllergens.ingredientId, ingredients.id))
      .where(eq(ingredients.accountId, accountId)),
    db.select({ r: ingredientCerts }).from(ingredientCerts)
      .innerJoin(ingredients, eq(ingredientCerts.ingredientId, ingredients.id))
      .where(eq(ingredients.accountId, accountId)),
    db.select({ r: subIngredients }).from(subIngredients)
      .innerJoin(ingredients, eq(subIngredients.ingredientId, ingredients.id))
      .where(eq(ingredients.accountId, accountId)),
    db.select({ r: ingredientDocs }).from(ingredientDocs)
      .innerJoin(ingredients, eq(ingredientDocs.ingredientId, ingredients.id))
      .where(eq(ingredients.accountId, accountId)),
    db.select({ r: ingredientSuppliers }).from(ingredientSuppliers)
      .innerJoin(ingredients, eq(ingredientSuppliers.ingredientId, ingredients.id))
      .where(eq(ingredients.accountId, accountId)),
    db.select({ r: formulationNfpPanels }).from(formulationNfpPanels)
      .innerJoin(formulations, eq(formulationNfpPanels.formulationId, formulations.id))
      .where(eq(formulations.accountId, accountId)),
  ])

  const sub = ctx.subscription
  const payload = {
    exportedAt: new Date().toISOString(),
    note: 'Document files are not included; ingredientDocs lists their storage paths.',
    account: {
      id: ctx.account.id,
      name: ctx.account.name,
      createdAt: ctx.account.createdAt,
      billingExempt: ctx.account.billingExempt,
    },
    subscription: sub
      ? {
          status: sub.status,
          priceId: sub.priceId,
          currentPeriodEnd: sub.currentPeriodEnd,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        }
      : null,
    profile: ctx.profile
      ? {
          email: ctx.user.email ?? null,
          fullName: ctx.profile.fullName,
          company: ctx.profile.company,
          jobTitle: ctx.profile.jobTitle,
          phone: ctx.profile.phone,
          timezone: ctx.profile.timezone,
          termsVersion: ctx.profile.termsVersion,
          termsAcceptedAt: ctx.profile.termsAcceptedAt,
          privacyVersion: ctx.profile.privacyVersion,
          privacyAcceptedAt: ctx.profile.privacyAcceptedAt,
        }
      : { email: ctx.user.email ?? null },
    members: memberRows,
    projects: projectRows,
    formulations: formulationRows,
    formulationLines: lineRows.map(x => x.r),
    processSteps: stepRows.map(x => x.r),
    formulationTargets: targetRows.map(x => x.r),
    batchRuns: runRows.map(x => x.r),
    formulationNfpPanels: nfpPanelRows.map(x => x.r),
    reverseTargets: reverseTargetRows.map(x => x.r),
    reverseCandidates: reverseCandidateRows.map(x => x.r),
    ingredients: ingredientRows,
    ingredientNutrients: nutrientRows.map(x => ({ ...x.r, nutrientName: x.nutrientName, nutrientUnit: x.nutrientUnit })),
    ingredientAllergens: allergenRows.map(x => x.r),
    ingredientCerts: certRows.map(x => x.r),
    subIngredients: subIngredientRows.map(x => x.r),
    ingredientDocs: docRows.map(x => x.r),
    suppliers: supplierRows,
    ingredientSuppliers: supplierLinkRows.map(x => x.r),
    equipment: equipmentRows,
  }

  const stamp = new Date().toISOString().slice(0, 10)
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="benchtop-export-${stamp}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
