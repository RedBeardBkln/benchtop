import { and, asc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  accountMembers, clientContacts, clients, equipment, formulationLines, formulationNfpPanels, formulationNotes,
  formulations, formulationTargets, batchRuns, ingredientAllergens, ingredientCerts, ingredientDocs, ingredientNutrients,
  ingredients, ingredientSuppliers, intakeItems, nutrients, processSteps, profiles, projects, sousChefConversations,
  sousChefMessages, sousChefNotes, subIngredients, supplierContacts, suppliers, timeEntries,
} from '@/lib/db/schema'
import { getAuthEmails } from '@/lib/supabase/admin'
import { calcNutrientProfile, type CalcResult } from '@/lib/formulation-calc'
import { computeCogs, resolveIngredientCost, type Cogs, type IngredientCost } from '@/lib/costing'
import { stageIndex } from '@/lib/staged-additions'

// Everything a full account export contains, read in one pass for one account. Every query is anchored
// to the account's own root rows (directly, or through a parent that is), so no other account's rows can
// appear. The export is owner-only, so team access doesn't narrow it; Sous Chef conversations are
// private, so only the exporting owner's own are included.

type Row<T extends { $inferSelect: unknown }> = T['$inferSelect']

export type ExportFormulation = Row<typeof formulations> & {
  projectName: string
  lines: Array<Row<typeof formulationLines> & {
    ingredientName: string
    /** 1-based step it's added after, or null for the starting blend */
    addedAfterStep: number | null
  }>
  steps: Array<Row<typeof processSteps> & { equipmentName: string | null }>
  /** Dated notes and findings recorded on the iteration (`notes` is the formulation's own text field) */
  iterationNotes: Row<typeof formulationNotes>[]
  targets: Array<Row<typeof formulationTargets> & { nutrientName: string | null }>
  batchRuns: Array<Row<typeof batchRuns> & { runByName: string | null }>
  /** Saved Nutrition Facts panels, oldest first */
  nfpPanels: Row<typeof formulationNfpPanels>[]
  /** Nutrient profile per 100 g finished and per serving, staged additions and process losses included (as in the editor) */
  calc: CalcResult
  /** Raw-material cost, from each ingredient's formulation cost (supplier price or manual), as in the editor */
  cogs: Cogs
}

export type ExportIngredient = Row<typeof ingredients> & {
  nutrients: Array<{ nutrientId: string; name: string; unit: string; amountPer100g: number; sourceRef: string; sourceUrl: string | null }>
  allergens: string[]
  certs: string[]
  subIngredients: string[]
  suppliers: Array<Row<typeof ingredientSuppliers> & { supplierName: string }>
  docs: Row<typeof ingredientDocs>[]
  /** The cost formulations use for it */
  cost: IngredientCost | null
}

export type ExportConversation = Row<typeof sousChefConversations> & {
  linkedTo: string | null
  messages: Row<typeof sousChefMessages>[]
}

export type ExportClient = Row<typeof clients> & { contacts: Row<typeof clientContacts>[] }
export type ExportSupplier = Row<typeof suppliers> & { contacts: Row<typeof supplierContacts>[] }

export type ExportData = {
  generatedAt: Date
  accountName: string
  userEmail: string | null
  clients: ExportClient[]
  projects: Row<typeof projects>[]
  formulations: ExportFormulation[]
  ingredients: ExportIngredient[]
  suppliers: ExportSupplier[]
  equipment: Row<typeof equipment>[]
  intake: Array<Row<typeof intakeItems> & { ingredientName: string | null }>
  timeEntries: Array<Row<typeof timeEntries> & { clientName: string; projectName: string | null; userName: string | null }>
  members: Array<{ userId: string; role: string; name: string | null; email: string | null; joinedAt: Date }>
  notebook: Array<Row<typeof sousChefNotes> & { createdByName: string | null; projectName: string | null; formulationLabel: string | null }>
  conversations: ExportConversation[]
}

const num = (v: string | null | undefined) => (v == null || v === '' ? null : Number(v))

function groupBy<T, K>(rows: T[], key: (r: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>()
  for (const r of rows) {
    const k = key(r)
    const list = m.get(k)
    if (list) list.push(r)
    else m.set(k, [r])
  }
  return m
}

/**
 * Read the whole account. Queries run one at a time: many in flight at once through the
 * connection pooler can stall until the statement timeout.
 */
export async function loadExportData(ctx: { account: { id: string; name: string }; user: { id: string; email?: string | null } }): Promise<ExportData> {
  const accountId = ctx.account.id
  const byFormulation = eq(formulations.accountId, accountId)
  const byIngredient = eq(ingredients.accountId, accountId)

  const clientRows = await db.select().from(clients).where(eq(clients.accountId, accountId)).orderBy(asc(clients.name))
  const contactRows = (await db.select({ r: clientContacts }).from(clientContacts)
    .innerJoin(clients, eq(clientContacts.clientId, clients.id))
    .where(eq(clients.accountId, accountId)).orderBy(asc(clientContacts.position))).map(x => x.r)
  const projectRows = await db.select().from(projects).where(eq(projects.accountId, accountId)).orderBy(asc(projects.name))
  const formulationRows = await db.select().from(formulations).where(byFormulation)
    .orderBy(asc(formulations.name), asc(formulations.version))
  const lineRows = (await db.select({ r: formulationLines }).from(formulationLines)
    .innerJoin(formulations, eq(formulationLines.formulationId, formulations.id))
    .where(byFormulation).orderBy(asc(formulationLines.position))).map(x => x.r)
  const stepRows = (await db.select({ r: processSteps }).from(processSteps)
    .innerJoin(formulations, eq(processSteps.formulationId, formulations.id))
    .where(byFormulation).orderBy(asc(processSteps.stepNo))).map(x => x.r)
  const noteRows = (await db.select({ r: formulationNotes }).from(formulationNotes)
    .innerJoin(formulations, eq(formulationNotes.formulationId, formulations.id))
    .where(byFormulation).orderBy(asc(formulationNotes.createdAt))).map(x => x.r)
  const targetRows = (await db.select({ r: formulationTargets }).from(formulationTargets)
    .innerJoin(formulations, eq(formulationTargets.formulationId, formulations.id))
    .where(byFormulation)).map(x => x.r)
  const runRows = (await db.select({ r: batchRuns }).from(batchRuns)
    .innerJoin(formulations, eq(batchRuns.formulationId, formulations.id))
    .where(byFormulation).orderBy(asc(batchRuns.runAt))).map(x => x.r)
  const panelRows = (await db.select({ r: formulationNfpPanels }).from(formulationNfpPanels)
    .innerJoin(formulations, eq(formulationNfpPanels.formulationId, formulations.id))
    .where(byFormulation).orderBy(asc(formulationNfpPanels.createdAt))).map(x => x.r)
  const ingredientRows = await db.select().from(ingredients).where(byIngredient).orderBy(asc(ingredients.name))
  const ingNutrientRows = (await db.select({ r: ingredientNutrients }).from(ingredientNutrients)
    .innerJoin(ingredients, eq(ingredientNutrients.ingredientId, ingredients.id))
    .where(byIngredient)).map(x => x.r)
  const allergenRows = (await db.select({ r: ingredientAllergens }).from(ingredientAllergens)
    .innerJoin(ingredients, eq(ingredientAllergens.ingredientId, ingredients.id))
    .where(byIngredient).orderBy(asc(ingredientAllergens.allergen))).map(x => x.r)
  const certRows = (await db.select({ r: ingredientCerts }).from(ingredientCerts)
    .innerJoin(ingredients, eq(ingredientCerts.ingredientId, ingredients.id))
    .where(byIngredient).orderBy(asc(ingredientCerts.cert))).map(x => x.r)
  const subRows = (await db.select({ r: subIngredients }).from(subIngredients)
    .innerJoin(ingredients, eq(subIngredients.ingredientId, ingredients.id))
    .where(byIngredient).orderBy(asc(subIngredients.position))).map(x => x.r)
  const docRows = (await db.select({ r: ingredientDocs }).from(ingredientDocs)
    .innerJoin(ingredients, eq(ingredientDocs.ingredientId, ingredients.id))
    .where(byIngredient).orderBy(asc(ingredientDocs.uploadedAt))).map(x => x.r)
  const supplierRows = await db.select().from(suppliers).where(eq(suppliers.accountId, accountId)).orderBy(asc(suppliers.name))
  const supplierContactRows = (await db.select({ r: supplierContacts }).from(supplierContacts)
    .innerJoin(suppliers, eq(supplierContacts.supplierId, suppliers.id))
    .where(eq(suppliers.accountId, accountId)).orderBy(asc(supplierContacts.position))).map(x => x.r)
  // Links count only when both ends are this account's
  const linkRows = (await db.select({ r: ingredientSuppliers }).from(ingredientSuppliers)
    .innerJoin(ingredients, eq(ingredientSuppliers.ingredientId, ingredients.id))
    .innerJoin(suppliers, eq(ingredientSuppliers.supplierId, suppliers.id))
    .where(and(byIngredient, eq(suppliers.accountId, accountId)))).map(x => x.r)
  const equipmentRows = await db.select().from(equipment).where(eq(equipment.accountId, accountId)).orderBy(asc(equipment.name))
  const intakeRows = await db.select().from(intakeItems).where(eq(intakeItems.accountId, accountId)).orderBy(asc(intakeItems.createdAt))
  const timeRows = await db.select().from(timeEntries).where(eq(timeEntries.accountId, accountId)).orderBy(asc(timeEntries.startedAt))
  const memberRows = await db
    .select({ userId: accountMembers.userId, role: accountMembers.role, fullName: profiles.fullName, joinedAt: accountMembers.createdAt })
    .from(accountMembers)
    .leftJoin(profiles, eq(profiles.userId, accountMembers.userId))
    .where(eq(accountMembers.accountId, accountId))
    .orderBy(asc(accountMembers.createdAt))
  const nutrientRows = await db.select().from(nutrients).orderBy(asc(nutrients.displayOrder))
  const notebookRows = await db.select().from(sousChefNotes).where(eq(sousChefNotes.accountId, accountId)).orderBy(asc(sousChefNotes.createdAt))
  const conversationRows = await db.select().from(sousChefConversations)
    .where(and(eq(sousChefConversations.accountId, accountId), eq(sousChefConversations.userId, ctx.user.id)))
    .orderBy(asc(sousChefConversations.createdAt))
  const messageRows = conversationRows.length
    ? await db.select().from(sousChefMessages)
        .where(inArray(sousChefMessages.conversationId, conversationRows.map(c => c.id)))
        .orderBy(asc(sousChefMessages.createdAt))
    : []

  // Names for people: the profile name, else the login email
  const emails = await getAuthEmails(memberRows.map(m => m.userId)).catch(() => new Map<string, string>())
  const personName = (userId: string | null | undefined) => {
    if (!userId) return null
    const m = memberRows.find(r => r.userId === userId)
    return m?.fullName || emails.get(userId) || null
  }

  const projectName = new Map(projectRows.map(p => [p.id, p.name]))
  const clientName = new Map(clientRows.map(c => [c.id, c.name]))
  const ingredientById = new Map(ingredientRows.map(i => [i.id, i]))
  const nutrientById = new Map(nutrientRows.map(n => [n.id, n]))
  const supplierName = new Map(supplierRows.map(s => [s.id, s.name]))
  const equipmentName = new Map(equipmentRows.map(e => [e.id, e.name]))
  const nutrientsByIngredient = groupBy(ingNutrientRows, r => r.ingredientId)
  const linksByIngredient = groupBy(linkRows, r => r.ingredientId)
  const linesByFormulation = groupBy(lineRows, r => r.formulationId)
  const stepsByFormulation = groupBy(stepRows, r => r.formulationId)
  const notesByFormulation = groupBy(noteRows, r => r.formulationId)
  const targetsByFormulation = groupBy(targetRows, r => r.formulationId)
  const runsByFormulation = groupBy(runRows, r => r.formulationId)
  const panelsByFormulation = groupBy(panelRows, r => r.formulationId)
  const messagesByConversation = groupBy(messageRows, r => r.conversationId)

  // The cost formulations use: the supplier price marked "use for cost", else the manual cost (lib/costing-server)
  const costOf = new Map(ingredientRows.map(i => [i.id, resolveIngredientCost(
    i.defaultCostPerKg,
    (linksByIngredient.get(i.id) ?? []).filter(l => l.useForCost).map(l => ({
      id: l.id, supplierName: supplierName.get(l.supplierId) ?? '', packUnit: l.packUnit, costPerUnit: l.costPerUnit, useForCost: l.useForCost,
    })),
  ).cost]))

  const allNutrients = nutrientRows.map(n => ({
    id: n.id, name: n.name, unit: n.unit, category: n.category, dailyValueAmount: num(n.dailyValueAmount),
  }))

  const exportFormulations: ExportFormulation[] = formulationRows.map(f => {
    const lines = linesByFormulation.get(f.id) ?? []
    const steps = stepsByFormulation.get(f.id) ?? []
    const servingSizeG = num(f.servingSizeG) ?? undefined
    // Same inputs as the editor and Sous Chef (lib/sous-chef-server get_formulation)
    const calc = calcNutrientProfile({
      lines: lines.map(l => ({
        ingredientId: l.ingredientId,
        weightG: Number(l.weightG),
        moisturePct: num(ingredientById.get(l.ingredientId)?.moisturePct),
        addedAfterStepId: l.addedAfterStepId,
        nutrients: (nutrientsByIngredient.get(l.ingredientId) ?? [])
          .map(n => ({ nutrientId: n.nutrientId, amountPer100g: Number(n.amountPer100g) })),
      })),
      allNutrients,
      servingSizeG,
      steps: steps.map(s => ({ id: s.id, lossType: s.lossType, lossAmount: num(s.lossAmount), lossUnit: s.lossUnit })),
    })
    const cogs = computeCogs({
      lines: lines.map(l => ({ key: l.id, ingredientId: l.ingredientId, name: ingredientById.get(l.ingredientId)?.name ?? '', weightG: Number(l.weightG) })),
      costPerKg: id => costOf.get(id)?.perKg ?? null,
      finishedWeightG: calc.processYield.finishedWeightG,
      servingSizeG: servingSizeG ?? null,
      unitSizeG: num(f.unitSizeG),
    })
    return {
      ...f,
      projectName: projectName.get(f.projectId) ?? '(unknown project)',
      lines: lines.map(l => {
        const i = stageIndex(l.addedAfterStepId, steps)
        return { ...l, ingredientName: ingredientById.get(l.ingredientId)?.name ?? '(deleted ingredient)', addedAfterStep: i < 0 ? null : i + 1 }
      }),
      steps: steps.map(s => ({ ...s, equipmentName: s.equipmentId ? equipmentName.get(s.equipmentId) ?? null : null })),
      iterationNotes: notesByFormulation.get(f.id) ?? [],
      targets: (targetsByFormulation.get(f.id) ?? [])
        .map(t => ({ ...t, nutrientName: t.nutrientId ? nutrientById.get(t.nutrientId)?.name ?? null : null })),
      batchRuns: (runsByFormulation.get(f.id) ?? []).map(r => ({ ...r, runByName: personName(r.runBy) })),
      nfpPanels: panelsByFormulation.get(f.id) ?? [],
      calc,
      cogs,
    }
  })

  const allergensBy = groupBy(allergenRows, r => r.ingredientId)
  const certsBy = groupBy(certRows, r => r.ingredientId)
  const subsBy = groupBy(subRows, r => r.ingredientId)
  const docsBy = groupBy(docRows, r => r.ingredientId)

  const exportIngredients: ExportIngredient[] = ingredientRows.map(i => ({
    ...i,
    nutrients: (nutrientsByIngredient.get(i.id) ?? [])
      .map(n => {
        const meta = nutrientById.get(n.nutrientId)
        return {
          nutrientId: n.nutrientId,
          name: meta?.name ?? '(unknown nutrient)',
          unit: meta?.unit ?? '',
          order: meta?.displayOrder ?? 0,
          amountPer100g: Number(n.amountPer100g),
          sourceRef: n.sourceRef,
          sourceUrl: n.sourceUrl,
        }
      })
      .sort((a, b) => a.order - b.order)
      .map(({ order: _order, ...n }) => n),
    allergens: (allergensBy.get(i.id) ?? []).map(a => a.allergen),
    certs: (certsBy.get(i.id) ?? []).map(c => c.cert),
    subIngredients: (subsBy.get(i.id) ?? []).map(s => s.name),
    suppliers: (linksByIngredient.get(i.id) ?? []).map(l => ({ ...l, supplierName: supplierName.get(l.supplierId) ?? '(deleted supplier)' })),
    docs: docsBy.get(i.id) ?? [],
    cost: costOf.get(i.id) ?? null,
  }))

  const formulationById = new Map(formulationRows.map(f => [f.id, f]))
  const formulationLabel = (id: string | null) => {
    const f = id ? formulationById.get(id) : undefined
    return f ? `${f.name} v${f.version}` : null
  }
  const familyName = (familyId: string | null) =>
    familyId ? formulationRows.find(f => f.familyId === familyId)?.name ?? null : null
  const contactsBy = groupBy(contactRows, r => r.clientId)
  const supplierContactsBy = groupBy(supplierContactRows, r => r.supplierId)

  return {
    generatedAt: new Date(),
    accountName: ctx.account.name,
    userEmail: ctx.user.email ?? null,
    clients: clientRows.map(c => ({ ...c, contacts: contactsBy.get(c.id) ?? [] })),
    projects: projectRows,
    formulations: exportFormulations,
    ingredients: exportIngredients,
    suppliers: supplierRows.map(s => ({ ...s, contacts: supplierContactsBy.get(s.id) ?? [] })),
    equipment: equipmentRows,
    intake: intakeRows.map(r => ({
      ...r,
      ingredientName: ingredientById.get(r.importedIngredientId ?? r.matchedIngredientId ?? '')?.name ?? null,
    })),
    timeEntries: timeRows.map(t => ({
      ...t,
      clientName: clientName.get(t.clientId) ?? '(deleted client)',
      projectName: t.projectId ? projectName.get(t.projectId) ?? null : null,
      userName: personName(t.userId),
    })),
    members: memberRows.map(m => ({ userId: m.userId, role: m.role, name: m.fullName, email: emails.get(m.userId) ?? null, joinedAt: m.joinedAt })),
    notebook: notebookRows.map(n => ({
      ...n,
      createdByName: personName(n.createdBy),
      projectName: n.projectId ? projectName.get(n.projectId) ?? null : null,
      formulationLabel: formulationLabel(n.formulationId),
    })),
    conversations: conversationRows.map(c => ({
      ...c,
      // Most specific link first: an iteration, else a whole formulation, else a project
      linkedTo: formulationLabel(c.formulationId)
        ?? familyName(c.formulationFamilyId)
        ?? (c.projectId ? projectName.get(c.projectId) ?? null : null),
      messages: messagesByConversation.get(c.id) ?? [],
    })),
  }
}
