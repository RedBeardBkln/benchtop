import type Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { and, desc, eq, ilike, inArray, isNull, ne, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  formulationLines, formulations, formulationTargets, ingredientAllergens, ingredientCerts, ingredientNutrients,
  ingredients, nutrients, processSteps, projects, sousChefConversations, sousChefMessages, sousChefNotes, subIngredients,
} from '@/lib/db/schema'
import { calcNutrientProfile } from '@/lib/formulation-calc'
import { categoryPath } from '@/lib/ingredient-categories'
import { getIngredientCosts } from '@/lib/costing-server'
import { getOwnedFormulation, getOwnedProject, visibleProjectIds, visibleProjects, type TenantScope } from '@/lib/tenancy'
import { NOTE_KIND_KEYS, NOTE_MAX_CHARS, NOTES_IN_PROMPT, type PromptNote, type SousChefNoteKind } from '@/lib/sous-chef'

export type SousChefScope = TenantScope & { user: { id: string } }

// ── Lab notebook ──────────────────────────────────────────────────────────────

export type NoteRow = PromptNote & {
  projectId: string | null
  formulationId: string | null
  conversationId: string | null
  createdBy: string
  retiredAt: Date | null
}

/** The account's notes the caller may see (a note on a project they can't see is hidden), newest first. */
export async function loadNotes(scope: TenantScope, opts: { includeRetired?: boolean; limit?: number } = {}): Promise<NoteRow[]> {
  const rows = await db
    .select({
      id: sousChefNotes.id,
      kind: sousChefNotes.kind,
      content: sousChefNotes.content,
      projectId: sousChefNotes.projectId,
      formulationId: sousChefNotes.formulationId,
      conversationId: sousChefNotes.conversationId,
      createdBy: sousChefNotes.createdBy,
      retiredAt: sousChefNotes.retiredAt,
      createdAt: sousChefNotes.createdAt,
      projectName: projects.name,
      formulationName: formulations.name,
      formulationVersion: formulations.version,
    })
    .from(sousChefNotes)
    .leftJoin(projects, eq(sousChefNotes.projectId, projects.id))
    .leftJoin(formulations, eq(sousChefNotes.formulationId, formulations.id))
    .where(and(
      eq(sousChefNotes.accountId, scope.account.id),
      opts.includeRetired ? undefined : isNull(sousChefNotes.retiredAt),
    ))
    .orderBy(desc(sousChefNotes.createdAt))
    .limit(opts.limit ?? 1000)
  const visible = await visibleProjectIds(scope)
  return rows
    .filter(r => !visible || !r.projectId || visible.has(r.projectId))
    .map(({ formulationVersion, ...r }) => ({
      ...r,
      kind: r.kind as SousChefNoteKind,
      formulationName: r.formulationName ? `${r.formulationName} v${formulationVersion}` : null,
    }))
}

export const loadPromptNotes = (scope: TenantScope) => loadNotes(scope, { limit: NOTES_IN_PROMPT })

/**
 * Checks a note's project/formulation belong to the caller and fills the project from the formulation.
 * Returns null when either can't be seen.
 */
export async function resolveNoteLinks(scope: TenantScope, links: { projectId?: string | null; formulationId?: string | null }) {
  let projectId = links.projectId ?? null
  const formulationId = links.formulationId ?? null
  if (formulationId) {
    const f = await getOwnedFormulation(scope, formulationId)
    if (!f) return null
    projectId = f.projectId
  } else if (projectId && !(await getOwnedProject(scope, projectId))) {
    return null
  }
  return { projectId, formulationId }
}

// ── Tools ─────────────────────────────────────────────────────────────────────

type ToolEnv = {
  scope: SousChefScope
  conversationId: string
  /** Called when a tool records a note, so the chat can show it */
  onNote: (note: { id: string; kind: SousChefNoteKind; content: string }) => void
}

type ToolDef<S extends z.ZodType> = {
  name: string
  description: string
  input: S
  /** Short label shown in the chat while the tool runs */
  label: (input: z.infer<S>) => string
  run: (input: z.infer<S>, env: ToolEnv) => Promise<unknown>
}

const tool = <S extends z.ZodType>(def: ToolDef<S>) => def

const num = (v: string | number | null | undefined) => (v == null ? null : Number(v))
// Enough precision for the model without a wall of digits
const round = (v: number) => Number(v.toPrecision(4))

const uuid = z.string().describe('An id returned by another tool')

const TOOLS = [
  tool({
    name: 'list_projects',
    description: 'List the team’s projects (product ideas): id, name, client, status, objective and how many formulations each has.',
    input: z.object({ includeArchived: z.boolean().optional().describe('Include archived projects (default false)') }),
    label: () => 'Looked through your projects',
    run: async ({ includeArchived }, { scope }) => {
      const rows = await db
        .select({
          id: projects.id, name: projects.name, client: projects.client, status: projects.status,
          objective: projects.objectiveText,
          formulationCount: sql<number>`(select count(distinct ${formulations.familyId})::int from ${formulations} where ${formulations.projectId} = ${projects.id} and ${formulations.archivedAt} is null)`,
        })
        .from(projects)
        .where(and(eq(projects.accountId, scope.account.id), includeArchived ? undefined : eq(projects.status, 'active')))
        .orderBy(desc(projects.updatedAt))
        .limit(200)
      return visibleProjects(scope, rows)
    },
  }),
  tool({
    name: 'get_project',
    description: 'One project in detail: objective, nutrition targets, required certifications, excluded allergens, and its formulations (every iteration, with ids).',
    input: z.object({ projectId: uuid }),
    label: () => 'Read a project',
    run: async ({ projectId }, { scope }) => {
      const p = await getOwnedProject(scope, projectId)
      if (!p) return { error: 'No project with that id' }
      const forms = await db
        .select({
          id: formulations.id, name: formulations.name, version: formulations.version, status: formulations.status,
          iterationNote: formulations.iterationNote, updatedAt: formulations.updatedAt,
        })
        .from(formulations)
        .where(and(eq(formulations.projectId, p.id), isNull(formulations.archivedAt), isNull(formulations.iterationArchivedAt)))
        .orderBy(formulations.name, desc(formulations.version))
      return {
        id: p.id, name: p.name, client: p.client, status: p.status, objective: p.objectiveText,
        targets: p.targets, requiredCerts: p.requiredCerts, excludedAllergens: p.excludedAllergens,
        formulations: forms,
      }
    },
  }),
  tool({
    name: 'get_formulation',
    description: 'One formulation in detail: each ingredient line (grams, % of batch, cost), process steps with losses, nutrition targets, and the calculated nutrient profile per 100 g finished product and per serving.',
    input: z.object({ formulationId: uuid }),
    label: () => 'Read a formulation',
    run: async ({ formulationId }, { scope }) => {
      const f = await getOwnedFormulation(scope, formulationId)
      if (!f) return { error: 'No formulation with that id' }
      const [project] = await db.select({ name: projects.name, targets: projects.targets }).from(projects).where(eq(projects.id, f.projectId))
      const lines = await db
        .select({
          ingredientId: formulationLines.ingredientId, name: ingredients.name, onHand: ingredients.onHand,
          moisturePct: ingredients.moisturePct, weightG: formulationLines.weightG, pct: formulationLines.pct,
          minPct: formulationLines.minPct, maxPct: formulationLines.maxPct,
        })
        .from(formulationLines)
        .innerJoin(ingredients, eq(formulationLines.ingredientId, ingredients.id))
        .where(eq(formulationLines.formulationId, f.id))
        .orderBy(formulationLines.position)
      const ids = [...new Set(lines.map(l => l.ingredientId))]
      const [nutrientRows, allNutrients, steps, targets, costs] = await Promise.all([
        ids.length
          ? db.select({ ingredientId: ingredientNutrients.ingredientId, nutrientId: ingredientNutrients.nutrientId, amountPer100g: ingredientNutrients.amountPer100g })
              .from(ingredientNutrients).where(inArray(ingredientNutrients.ingredientId, ids))
          : Promise.resolve([]),
        db.select({ id: nutrients.id, name: nutrients.name, unit: nutrients.unit, category: nutrients.category, dailyValueAmount: nutrients.dailyValueAmount })
          .from(nutrients).orderBy(nutrients.displayOrder),
        db.select({ stepNo: processSteps.stepNo, instruction: processSteps.instruction, params: processSteps.params, lossType: processSteps.lossType, lossAmount: processSteps.lossAmount, lossUnit: processSteps.lossUnit })
          .from(processSteps).where(eq(processSteps.formulationId, f.id)).orderBy(processSteps.stepNo),
        db.select({ nutrient: nutrients.name, label: formulationTargets.label, comparator: formulationTargets.comparator, value: formulationTargets.value, valueMax: formulationTargets.valueMax, unit: formulationTargets.unit, basis: formulationTargets.basis })
          .from(formulationTargets).leftJoin(nutrients, eq(formulationTargets.nutrientId, nutrients.id))
          .where(eq(formulationTargets.formulationId, f.id)),
        getIngredientCosts(scope.account.id, ids),
      ])
      const servingSizeG = num(f.servingSizeG) ?? undefined
      const calc = calcNutrientProfile({
        lines: lines.map(l => ({
          ingredientId: l.ingredientId,
          weightG: Number(l.weightG),
          moisturePct: num(l.moisturePct),
          nutrients: nutrientRows.filter(n => n.ingredientId === l.ingredientId).map(n => ({ nutrientId: n.nutrientId, amountPer100g: Number(n.amountPer100g) })),
        })),
        allNutrients: allNutrients.map(n => ({ ...n, dailyValueAmount: num(n.dailyValueAmount) })),
        servingSizeG,
        steps: steps.map(s => ({ lossType: s.lossType, lossAmount: num(s.lossAmount), lossUnit: s.lossUnit })),
      })
      return {
        id: f.id, name: f.name, version: f.version, status: f.status, project: project?.name,
        servingSizeG: servingSizeG ?? null, batchSizeG: num(f.batchSizeG), notes: f.notes, iterationNote: f.iterationNote,
        lines: lines.map(l => ({
          ingredientId: l.ingredientId, ingredient: l.name, onHand: l.onHand,
          grams: round(Number(l.weightG)), pct: round(Number(l.pct)),
          solverBounds: l.minPct != null || l.maxPct != null ? { minPct: num(l.minPct), maxPct: num(l.maxPct) } : undefined,
          costPerKg: costs[l.ingredientId]?.cost?.perKg ?? null,
        })),
        processSteps: steps.map(s => ({ step: s.stepNo, instruction: s.instruction, params: s.params, loss: s.lossType ? `${s.lossType} ${num(s.lossAmount)} ${s.lossUnit}` : null })),
        yieldPct: round(calc.processYield.yieldPct),
        formulationTargets: targets,
        projectTargets: project?.targets ?? [],
        nutrientsPer100gFinished: Object.fromEntries(calc.results.filter(r => r.perFinished100g !== 0)
          .map(r => [r.name, `${round(r.perFinished100g)} ${r.unit}`])),
        nutrientsPerServing: servingSizeG
          ? Object.fromEntries(calc.results.filter(r => r.perServing).map(r => [r.name, `${round(r.perServing!)} ${r.unit}`]))
          : null,
      }
    },
  }),
  tool({
    name: 'search_ingredients',
    description: 'Search the team’s ingredient library by name, label name, brand or category. Returns id, name, category, whether it’s on hand in the lab, brand and supplier.',
    input: z.object({
      query: z.string().describe('Words to match, e.g. "pea protein" or "hydrocolloid"; empty lists everything'),
      onHandOnly: z.boolean().optional().describe('Only ingredients physically in the lab'),
    }),
    label: ({ query }) => (query ? `Searched your ingredient library for “${query}”` : 'Looked through your ingredient library'),
    run: async ({ query, onHandOnly }, { scope }) => {
      const words = query.trim().split(/\s+/).filter(Boolean).slice(0, 6)
      const rows = await db
        .select({
          id: ingredients.id, name: ingredients.name, category: ingredients.category, subcategory: ingredients.subcategory,
          microCategory: ingredients.microCategory, onHand: ingredients.onHand, brand: ingredients.brandName, supplier: ingredients.supplierName,
        })
        .from(ingredients)
        .where(and(
          eq(ingredients.accountId, scope.account.id),
          isNull(ingredients.archivedAt),
          onHandOnly ? eq(ingredients.onHand, true) : undefined,
          ...words.map(w => {
            const like = `%${w.replace(/[%_\\]/g, m => `\\${m}`)}%`
            return or(ilike(ingredients.name, like), ilike(ingredients.labelName, like), ilike(ingredients.brandName, like),
              ilike(ingredients.category, like), ilike(ingredients.subcategory, like), ilike(ingredients.microCategory, like))
          }),
        ))
        .orderBy(desc(ingredients.onHand), ingredients.name)
        .limit(40)
      return rows.map(({ category, subcategory, microCategory, ...r }) => ({ ...r, category: categoryPath({ category, subcategory, microCategory }) || null }))
    },
  }),
  tool({
    name: 'get_ingredient',
    description: 'One library ingredient in detail: nutrients per 100 g, allergens, certifications, sub-ingredients, moisture, density, cost per kg and notes.',
    input: z.object({ ingredientId: uuid }),
    label: () => 'Read an ingredient',
    run: async ({ ingredientId }, { scope }) => {
      const [i] = await db.select().from(ingredients)
        .where(and(eq(ingredients.id, ingredientId), eq(ingredients.accountId, scope.account.id))).limit(1)
      if (!i) return { error: 'No ingredient with that id' }
      const [nuts, allergens, certs, subs, costs] = await Promise.all([
        db.select({ name: nutrients.name, unit: nutrients.unit, amount: ingredientNutrients.amountPer100g })
          .from(ingredientNutrients).innerJoin(nutrients, eq(ingredientNutrients.nutrientId, nutrients.id))
          .where(eq(ingredientNutrients.ingredientId, i.id)).orderBy(nutrients.displayOrder),
        db.select({ a: ingredientAllergens.allergen }).from(ingredientAllergens).where(eq(ingredientAllergens.ingredientId, i.id)),
        db.select({ c: ingredientCerts.cert }).from(ingredientCerts).where(eq(ingredientCerts.ingredientId, i.id)),
        db.select({ name: subIngredients.name }).from(subIngredients).where(eq(subIngredients.ingredientId, i.id)).orderBy(subIngredients.position),
        getIngredientCosts(scope.account.id, [i.id]),
      ])
      return {
        id: i.id, name: i.name, labelName: i.labelName, brand: i.brandName, supplier: i.supplierName,
        category: categoryPath(i) || null, onHand: i.onHand, verification: i.verification,
        moisturePct: num(i.moisturePct), densityGPerMl: num(i.densityGPerMl), costPerKg: costs[i.id]?.cost?.perKg ?? null,
        notes: i.notes, allergens: allergens.map(a => a.a), certifications: certs.map(c => c.c), subIngredients: subs.map(s => s.name),
        nutrientsPer100g: Object.fromEntries(nuts.map(n => [n.name, `${round(Number(n.amount))} ${n.unit}`])),
      }
    },
  }),
  tool({
    name: 'search_past_conversations',
    description: 'Search this person’s earlier Sous Chef conversations for a word or phrase, to recall what was discussed before.',
    input: z.object({ query: z.string().min(2) }),
    label: ({ query }) => `Searched earlier conversations for “${query}”`,
    run: async ({ query }, { scope, conversationId }) => {
      const like = `%${query.trim().replace(/[%_\\]/g, m => `\\${m}`)}%`
      const rows = await db
        .select({
          conversation: sousChefConversations.title, role: sousChefMessages.role,
          content: sousChefMessages.content, at: sousChefMessages.createdAt,
        })
        .from(sousChefMessages)
        .innerJoin(sousChefConversations, eq(sousChefMessages.conversationId, sousChefConversations.id))
        .where(and(
          eq(sousChefConversations.accountId, scope.account.id),
          eq(sousChefConversations.userId, scope.user.id),
          ne(sousChefConversations.id, conversationId),
          ilike(sousChefMessages.content, like),
        ))
        .orderBy(desc(sousChefMessages.createdAt))
        .limit(15)
      return rows.map(r => {
        const at = r.content.toLowerCase().indexOf(query.trim().toLowerCase())
        const start = Math.max(0, at - 300)
        return { conversation: r.conversation, role: r.role, date: r.at.toISOString().slice(0, 10), excerpt: r.content.slice(start, start + 800) }
      })
    },
  }),
  tool({
    name: 'record_note',
    description: 'Record a note in the team’s lab notebook. It is applied in every later conversation, across all projects.',
    input: z.object({
      kind: z.enum(NOTE_KIND_KEYS),
      content: z.string().min(1).max(NOTE_MAX_CHARS).describe('The fact and the reason, in one or two sentences'),
      projectId: uuid.optional().describe('The project it came from, if any'),
      formulationId: uuid.optional().describe('The formulation it came from, if any'),
    }),
    label: () => 'Recorded a note in the lab notebook',
    run: async ({ kind, content, projectId, formulationId }, { scope, conversationId, onNote }) => {
      const links = await resolveNoteLinks(scope, { projectId, formulationId })
      if (!links) return { error: 'That project or formulation was not found; record the note without it or use a valid id' }
      const [row] = await db.insert(sousChefNotes).values({
        accountId: scope.account.id, createdBy: scope.user.id, kind, content: content.trim(), conversationId, ...links,
      }).returning({ id: sousChefNotes.id })
      onNote({ id: row.id, kind, content: content.trim() })
      return { recorded: row.id }
    },
  }),
  tool({
    name: 'retire_note',
    description: 'Retire a lab-notebook note that has been superseded or turned out wrong, so it is no longer applied. It stays in the record.',
    input: z.object({ noteId: uuid.describe('The id in square brackets in the lab notebook') }),
    label: () => 'Retired a note in the lab notebook',
    run: async ({ noteId }, { scope }) => {
      const visible = (await loadNotes(scope)).some(n => n.id === noteId)
      if (!visible) return { error: 'No live note with that id' }
      await db.update(sousChefNotes).set({ retiredAt: new Date(), updatedAt: new Date() })
        .where(and(eq(sousChefNotes.id, noteId), eq(sousChefNotes.accountId, scope.account.id)))
      return { retired: noteId }
    },
  }),
]

const TOOLS_BY_NAME = new Map<string, ToolDef<z.ZodType>>(TOOLS.map(t => [t.name, t as unknown as ToolDef<z.ZodType>]))

export const WEB_SEARCH_TOOL = { type: 'web_search_20260209', name: 'web_search', max_uses: 5 } as const

/** Tool definitions in a fixed order (keeps the prompt cache stable) */
export const SOUS_CHEF_TOOLS: Anthropic.Beta.BetaToolUnion[] = [
  ...TOOLS.map(t => {
    // The API wants a plain object schema, without the $schema dialect marker zod adds
    const { $schema: _dialect, ...schema } = z.toJSONSchema(t.input, { io: 'input' }) as Record<string, unknown>
    return { name: t.name, description: t.description, input_schema: schema as Anthropic.Beta.BetaTool.InputSchema }
  }),
  WEB_SEARCH_TOOL,
]

/** Runs one tool call. Errors come back as an is_error result so the model can recover. */
export async function runSousChefTool(
  block: { id: string; name: string; input: unknown },
  env: ToolEnv,
): Promise<{ result: Anthropic.Beta.BetaToolResultBlockParam; label: string | null }> {
  const def = TOOLS_BY_NAME.get(block.name)
  const fail = (message: string) => ({ result: { type: 'tool_result' as const, tool_use_id: block.id, is_error: true, content: message }, label: null })
  if (!def) return fail(`Unknown tool ${block.name}`)
  const parsed = def.input.safeParse(block.input)
  if (!parsed.success) return fail(`Invalid input: ${parsed.error.message}`)
  try {
    const out = await def.run(parsed.data, env)
    return { result: { type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(out) }, label: def.label(parsed.data) }
  } catch (err) {
    console.error(`[sous-chef] tool ${block.name}`, err)
    return fail('The tool failed; try again or carry on without it')
  }
}

