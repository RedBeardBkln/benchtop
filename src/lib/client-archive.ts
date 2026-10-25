import { and, eq, inArray, isNotNull, isNull, notInArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { clients, formulationLines, formulations, ingredients, ingredientSuppliers, projects, suppliers } from '@/lib/db/schema'
import { checkArchiveSelection, type ClientArchivePlan } from '@/lib/client-archive-plan'

// Archiving a client archives its projects and their formulations, plus any ingredients and suppliers the
// user picks that nothing else uses. Everything archived this way is tagged archived_with_client_id, so
// unarchiving the client can offer it back item by item.

const nameKey = (s: string) => s.trim().toLowerCase()

/** What archiving this client would touch, and which ingredients and suppliers are eligible. */
export async function loadArchivePlan(accountId: string, clientId: string): Promise<ClientArchivePlan> {
  const projectRows = await db
    .select({ id: projects.id, name: projects.name, status: projects.status })
    .from(projects)
    .where(and(eq(projects.accountId, accountId), eq(projects.clientId, clientId)))
  const projectIds = projectRows.map(p => p.id)
  if (projectIds.length === 0) return { projects: [], formulationCount: 0, ingredients: [], suppliers: [] }

  const formRows = await db
    .select({ id: formulations.id, familyId: formulations.familyId })
    .from(formulations)
    .where(and(eq(formulations.accountId, accountId), inArray(formulations.projectId, projectIds)))
  const formIds = formRows.map(f => f.id)
  const formulationCount = new Set(formRows.map(f => f.familyId)).size
  if (formIds.length === 0) return { projects: projectRows, formulationCount, ingredients: [], suppliers: [] }

  // The client's ingredients: used in its formulations, or saved from one of them
  const used = await db
    .selectDistinct({ id: formulationLines.ingredientId })
    .from(formulationLines)
    .where(inArray(formulationLines.formulationId, formIds))
  const saved = await db
    .select({ id: ingredients.id })
    .from(ingredients)
    .where(and(eq(ingredients.accountId, accountId), inArray(ingredients.sourceFormulationId, formIds)))
  const candidateIds = [...new Set([...used, ...saved].map(r => r.id))]
  if (candidateIds.length === 0) return { projects: projectRows, formulationCount, ingredients: [], suppliers: [] }

  const ingredientRows = await db
    .select({ id: ingredients.id, name: ingredients.name, supplierName: ingredients.supplierName })
    .from(ingredients)
    .where(and(eq(ingredients.accountId, accountId), inArray(ingredients.id, candidateIds), isNull(ingredients.archivedAt)))
  const clientIds = ingredientRows.map(i => i.id)
  if (clientIds.length === 0) return { projects: projectRows, formulationCount, ingredients: [], suppliers: [] }

  // Formulations outside this client's projects that use each ingredient (archived ones count too)
  const elsewhere = await db
    .select({ ingredientId: formulationLines.ingredientId, count: sql<number>`count(distinct ${formulations.familyId})::int` })
    .from(formulationLines)
    .innerJoin(formulations, eq(formulationLines.formulationId, formulations.id))
    .where(and(
      inArray(formulationLines.ingredientId, clientIds),
      eq(formulations.accountId, accountId),
      notInArray(formulations.projectId, projectIds),
    ))
    .groupBy(formulationLines.ingredientId)
  const elsewhereBy = new Map(elsewhere.map(r => [r.ingredientId, r.count]))

  // Suppliers of the client's ingredients, by sourcing link or by the ingredient's Supplier field
  const supplierRows = await db
    .select({ id: suppliers.id, name: suppliers.name })
    .from(suppliers)
    .where(and(eq(suppliers.accountId, accountId), isNull(suppliers.archivedAt)))
  const clientLinks = await db
    .select({ supplierId: ingredientSuppliers.supplierId, ingredientId: ingredientSuppliers.ingredientId })
    .from(ingredientSuppliers)
    .where(inArray(ingredientSuppliers.ingredientId, clientIds))
  const supplying = new Map<string, Set<string>>()
  const add = (supplierId: string, ingredientId: string) =>
    supplying.set(supplierId, (supplying.get(supplierId) ?? new Set()).add(ingredientId))
  for (const l of clientLinks) add(l.supplierId, l.ingredientId)
  const supplierByName = new Map(supplierRows.map(s => [nameKey(s.name), s.id]))
  for (const i of ingredientRows) {
    const sid = i.supplierName ? supplierByName.get(nameKey(i.supplierName)) : undefined
    if (sid) add(sid, i.id)
  }
  const candidates = supplierRows.filter(s => supplying.has(s.id))

  // Each candidate's other active ingredients
  const otherBy = new Map<string, Set<string>>()
  if (candidates.length > 0) {
    const candidateIdsS = candidates.map(s => s.id)
    const [otherLinks, otherNamed] = await Promise.all([
      db
        .select({ supplierId: ingredientSuppliers.supplierId, ingredientId: ingredientSuppliers.ingredientId })
        .from(ingredientSuppliers)
        .innerJoin(ingredients, eq(ingredientSuppliers.ingredientId, ingredients.id))
        .where(and(
          inArray(ingredientSuppliers.supplierId, candidateIdsS),
          notInArray(ingredientSuppliers.ingredientId, clientIds),
          isNull(ingredients.archivedAt),
        )),
      db
        .select({ id: ingredients.id, supplierName: ingredients.supplierName })
        .from(ingredients)
        .where(and(
          eq(ingredients.accountId, accountId),
          isNull(ingredients.archivedAt),
          notInArray(ingredients.id, clientIds),
          inArray(sql`lower(trim(${ingredients.supplierName}))`, candidates.map(s => nameKey(s.name))),
        )),
    ])
    const addOther = (supplierId: string, ingredientId: string) =>
      otherBy.set(supplierId, (otherBy.get(supplierId) ?? new Set()).add(ingredientId))
    for (const l of otherLinks) addOther(l.supplierId, l.ingredientId)
    for (const i of otherNamed) {
      const sid = supplierByName.get(nameKey(i.supplierName!))
      if (sid) addOther(sid, i.id)
    }
  }

  return {
    projects: projectRows,
    formulationCount,
    ingredients: ingredientRows
      .map(i => ({ id: i.id, name: i.name, otherFormulations: elsewhereBy.get(i.id) ?? 0 }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    suppliers: candidates
      .map(s => ({
        id: s.id,
        name: s.name,
        clientIngredientIds: [...supplying.get(s.id)!],
        otherIngredients: otherBy.get(s.id)?.size ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}

/** Archives the client, its projects and formulations, and the chosen ingredients and suppliers. */
export async function archiveClient(
  accountId: string,
  clientId: string,
  ingredientIds: string[],
  supplierIds: string[],
): Promise<{ error: string } | { ok: true }> {
  const plan = await loadArchivePlan(accountId, clientId)
  const problem = checkArchiveSelection(plan, ingredientIds, supplierIds)
  if (problem) return { error: problem }

  const now = new Date()
  const projectIds = plan.projects.map(p => p.id)
  await db.transaction(async tx => {
    await tx.update(clients).set({ archivedAt: now, updatedAt: now })
      .where(and(eq(clients.id, clientId), eq(clients.accountId, accountId)))
    if (projectIds.length > 0) {
      // Only what's still active is tagged, so unarchiving doesn't revive things archived earlier on purpose
      await tx.update(projects).set({ status: 'archived', archivedWithClientId: clientId, updatedAt: now })
        .where(and(eq(projects.accountId, accountId), inArray(projects.id, projectIds), eq(projects.status, 'active')))
      await tx.update(formulations).set({ archivedAt: now, archivedWithClientId: clientId })
        .where(and(eq(formulations.accountId, accountId), inArray(formulations.projectId, projectIds), isNull(formulations.archivedAt)))
    }
    if (ingredientIds.length > 0) {
      await tx.update(ingredients).set({ archivedAt: now, archivedWithClientId: clientId })
        .where(and(eq(ingredients.accountId, accountId), inArray(ingredients.id, ingredientIds)))
    }
    if (supplierIds.length > 0) {
      await tx.update(suppliers).set({ archivedAt: now, archivedWithClientId: clientId })
        .where(and(eq(suppliers.accountId, accountId), inArray(suppliers.id, supplierIds)))
    }
  })
  return { ok: true }
}

export type ClientRestorePlan = {
  // withClient: archived when the client was; the others were archived separately, before
  projects: Array<{ id: string; name: string; withClient: boolean }>
  formulations: Array<{ familyId: string; name: string; projectName: string }>
  ingredients: Array<{ id: string; name: string }>
  suppliers: Array<{ id: string; name: string }>
}

/** What unarchiving this client can bring back. */
export async function loadRestorePlan(accountId: string, clientId: string): Promise<ClientRestorePlan> {
  const [projectRows, formRows, ingredientRows, supplierRows] = await Promise.all([
    db
      .select({ id: projects.id, name: projects.name, withClient: projects.archivedWithClientId })
      .from(projects)
      .where(and(eq(projects.accountId, accountId), eq(projects.clientId, clientId), eq(projects.status, 'archived'))),
    db
      .selectDistinctOn([formulations.familyId], { familyId: formulations.familyId, name: formulations.name, projectName: projects.name })
      .from(formulations)
      .innerJoin(projects, eq(formulations.projectId, projects.id))
      .where(and(
        eq(formulations.accountId, accountId),
        eq(projects.clientId, clientId),
        eq(formulations.archivedWithClientId, clientId),
        isNotNull(formulations.archivedAt),
      )),
    db
      .select({ id: ingredients.id, name: ingredients.name })
      .from(ingredients)
      .where(and(eq(ingredients.accountId, accountId), eq(ingredients.archivedWithClientId, clientId), isNotNull(ingredients.archivedAt))),
    db
      .select({ id: suppliers.id, name: suppliers.name })
      .from(suppliers)
      .where(and(eq(suppliers.accountId, accountId), eq(suppliers.archivedWithClientId, clientId), isNotNull(suppliers.archivedAt))),
  ])
  const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name)
  return {
    projects: projectRows.map(p => ({ id: p.id, name: p.name, withClient: p.withClient === clientId })).sort(byName),
    formulations: formRows.sort((a, b) => a.projectName.localeCompare(b.projectName) || a.name.localeCompare(b.name)),
    ingredients: ingredientRows.sort(byName),
    suppliers: supplierRows.sort(byName),
  }
}

/** Unarchives the client and whichever of its archived projects, formulations, ingredients and suppliers are chosen. */
export async function unarchiveClient(
  accountId: string,
  clientId: string,
  pick: { projectIds: string[]; familyIds: string[]; ingredientIds: string[]; supplierIds: string[] },
) {
  const now = new Date()
  await db.transaction(async tx => {
    await tx.update(clients).set({ archivedAt: null, updatedAt: now })
      .where(and(eq(clients.id, clientId), eq(clients.accountId, accountId)))
    if (pick.projectIds.length > 0) {
      await tx.update(projects).set({ status: 'active', archivedWithClientId: null, updatedAt: now })
        .where(and(eq(projects.accountId, accountId), eq(projects.clientId, clientId), inArray(projects.id, pick.projectIds)))
    }
    if (pick.familyIds.length > 0) {
      const clientProjects = tx.select({ id: projects.id }).from(projects)
        .where(and(eq(projects.accountId, accountId), eq(projects.clientId, clientId)))
      await tx.update(formulations).set({ archivedAt: null, archivedWithClientId: null })
        .where(and(
          eq(formulations.accountId, accountId),
          inArray(formulations.familyId, pick.familyIds),
          inArray(formulations.projectId, clientProjects),
        ))
    }
    if (pick.ingredientIds.length > 0) {
      await tx.update(ingredients).set({ archivedAt: null, archivedWithClientId: null })
        .where(and(eq(ingredients.accountId, accountId), eq(ingredients.archivedWithClientId, clientId), inArray(ingredients.id, pick.ingredientIds)))
    }
    if (pick.supplierIds.length > 0) {
      await tx.update(suppliers).set({ archivedAt: null, archivedWithClientId: null })
        .where(and(eq(suppliers.accountId, accountId), eq(suppliers.archivedWithClientId, clientId), inArray(suppliers.id, pick.supplierIds)))
    }
  })
}
