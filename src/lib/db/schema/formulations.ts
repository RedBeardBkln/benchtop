import {
  pgTable, uuid, text, integer, numeric, boolean,
  timestamp, jsonb, index, uniqueIndex, foreignKey,
} from 'drizzle-orm/pg-core'
import { formulationModeEnum, formulationStatusEnum, targetBasisEnum } from './enums'
import { projects } from './projects'
import { ingredients } from './ingredients'
import { nutrients } from './nutrients'
import { equipment } from './equipment'
import { accounts } from './accounts'

export const formulations = pgTable('formulations', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Denormalized from the project; must always equal the project's account_id
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  version: integer('version').notNull().default(1),
  // Groups all iterations (versions) of one formulation; equals the id of its v1 row.
  // Set explicitly on insert (id and familyId are generated together).
  familyId: uuid('family_id').notNull(),
  // Self-reference: the iteration this one was duplicated from
  parentFormulationId: uuid('parent_formulation_id'),
  mode: formulationModeEnum('mode').notNull().default('ground_up'),
  status: formulationStatusEnum('status').notNull().default('draft'),
  servingSizeG: numeric('serving_size_g', { precision: 10, scale: 4 }),
  batchSizeG: numeric('batch_size_g', { precision: 12, scale: 4 }),
  // When true, batch_size_g is a fixed target: ingredient quantities rebalance to always total it
  batchLocked: boolean('batch_locked').notNull().default(false),
  // Legacy: yield is now derived from the process steps' loss (see lib/process-loss.ts); no longer read or written
  yieldPct: numeric('yield_pct', { precision: 8, scale: 5 }).notNull().default('100.00000'),
  notes: text('notes'),
  // What distinguishes this iteration from its siblings; per-row and never copied, so a new iteration starts blank
  iterationNote: text('iteration_note'),
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('formulations_project_idx').on(t.projectId),
  index('formulations_account_idx').on(t.accountId),
  index('formulations_parent_idx').on(t.parentFormulationId),
  uniqueIndex('formulations_family_version_uq').on(t.familyId, t.version),
  // Self-referential FK — safe to define here since Postgres allows forward-references in ALTER TABLE
  foreignKey({
    columns: [t.parentFormulationId],
    foreignColumns: [t.id],
    name: 'formulations_parent_fk',
  }).onDelete('set null'),
])

// Ingredient lines — must sum to 100% (validated in app + DB constraint via trigger)
export const formulationLines = pgTable('formulation_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  formulationId: uuid('formulation_id').notNull().references(() => formulations.id, { onDelete: 'cascade' }),
  ingredientId: uuid('ingredient_id').notNull().references(() => ingredients.id, { onDelete: 'restrict' }),
  position: integer('position').notNull(),
  weightG: numeric('weight_g', { precision: 12, scale: 4 }).notNull(),
  pct: numeric('pct', { precision: 8, scale: 5 }).notNull(), // % of total batch input
  minPct: numeric('min_pct', { precision: 8, scale: 5 }),     // solver lower bound
  maxPct: numeric('max_pct', { precision: 8, scale: 5 }),     // solver upper bound
  locked: boolean('locked').notNull().default(false),          // quantity lock: fixed grams, excluded from solver
  // Usage-% lock: the line is always `pct` % of the batch (pct then holds the locked value)
  pctLocked: boolean('pct_locked').notNull().default(false),
}, (t) => [
  index('formulation_lines_formulation_idx').on(t.formulationId),
  index('formulation_lines_ingredient_idx').on(t.ingredientId),
])

export const processSteps = pgTable('process_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  formulationId: uuid('formulation_id').notNull().references(() => formulations.id, { onDelete: 'cascade' }),
  stepNo: integer('step_no').notNull(),
  instruction: text('instruction').notNull(),
  // Structured params: temp_c, time_min, ph, solids_pct, shear, pressure, custom k/v
  params: jsonb('params').notNull().default('{}'),
  // Legacy per-step loss %, superseded by loss_type / loss_amount / loss_unit; no longer read or written
  lossPct: numeric('loss_pct', { precision: 6, scale: 4 }),
  // 'production' = product left on equipment (yield drops, profile unchanged);
  // 'moisture' = water driven off (yield drops, profile concentrates). null = no loss at this step.
  lossType: text('loss_type'),
  lossAmount: numeric('loss_amount', { precision: 12, scale: 4 }),
  // 'g' = grams, 'pct' = % of the batch weight entering this step
  lossUnit: text('loss_unit').notNull().default('g'),
  // Equipment used for this step; cleared (not cascaded) if the equipment is ever removed
  equipmentId: uuid('equipment_id').references(() => equipment.id, { onDelete: 'set null' }),
}, (t) => [
  index('process_steps_formulation_idx').on(t.formulationId),
])

// Snapshot of project targets at iteration lock time (keeps old versions auditable)
export const batchRuns = pgTable('batch_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  formulationId: uuid('formulation_id').notNull().references(() => formulations.id, { onDelete: 'cascade' }),
  batchMultiplier: numeric('batch_multiplier', { precision: 10, scale: 4 }).notNull().default('1'),
  notes: text('notes'),
  runAt: timestamp('run_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('batch_runs_formulation_idx').on(t.formulationId),
])

// A Nutrition Facts Panel saved against one iteration (a formulations row is one iteration, so the
// panel belongs to exactly that version). `model` is the fully-rounded label (see lib/nfp-model.ts)
// and is displayed as-is later, so it never changes when ingredient data or the rules do.
// Tenant scope comes from the parent formulation (cascade-deleted with it).
export const formulationNfpPanels = pgTable('formulation_nfp_panels', {
  id: uuid('id').primaryKey().defaultRandom(),
  formulationId: uuid('formulation_id').notNull().references(() => formulations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  // Version of the FDA rounding rules the model was built with (lib/fda-rounding.ts RULES_VERSION)
  rulesVersion: text('rules_version').notNull(),
  servingSizeG: numeric('serving_size_g', { precision: 10, scale: 4 }),
  // Dialog settings used (hide zeros, extras picked, statements) so the panel can be re-opened and tweaked
  options: jsonb('options').notNull().default('{}'),
  model: jsonb('model').notNull(),
  createdBy: uuid('created_by'), // Supabase auth UID
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('formulation_nfp_panels_formulation_idx').on(t.formulationId),
])

export const formulationTargets = pgTable('formulation_targets', {
  id: uuid('id').primaryKey().defaultRandom(),
  formulationId: uuid('formulation_id').notNull().references(() => formulations.id, { onDelete: 'cascade' }),
  nutrientId: uuid('nutrient_id').references(() => nutrients.id, { onDelete: 'set null' }),
  label: text('label'),  // fallback display label when nutrientId is null
  comparator: text('comparator').notNull(), // <=, >=, =, range
  value: numeric('value', { precision: 12, scale: 6 }).notNull(),
  valueMax: numeric('value_max', { precision: 12, scale: 6 }), // upper bound for range
  unit: text('unit').notNull(),
  basis: targetBasisEnum('basis').notNull().default('per_100g'),
  snapshotAt: timestamp('snapshot_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('formulation_targets_formulation_idx').on(t.formulationId),
])
