import {
  pgTable, uuid, text, integer, numeric, boolean,
  timestamp, jsonb, index, foreignKey,
} from 'drizzle-orm/pg-core'
import { formulationModeEnum, formulationStatusEnum, targetBasisEnum } from './enums'
import { projects } from './projects'
import { ingredients } from './ingredients'
import { nutrients } from './nutrients'

export const formulations = pgTable('formulations', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  version: integer('version').notNull().default(1),
  // Self-reference: tracks lineage when duplicating as new iteration
  parentFormulationId: uuid('parent_formulation_id'),
  mode: formulationModeEnum('mode').notNull().default('ground_up'),
  status: formulationStatusEnum('status').notNull().default('draft'),
  servingSizeG: numeric('serving_size_g', { precision: 10, scale: 4 }),
  batchSizeG: numeric('batch_size_g', { precision: 12, scale: 4 }),
  // yield = output / input × 100; used to compute as-served nutrient concentrations
  yieldPct: numeric('yield_pct', { precision: 8, scale: 5 }).notNull().default('100.00000'),
  notes: text('notes'),
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('formulations_project_idx').on(t.projectId),
  index('formulations_parent_idx').on(t.parentFormulationId),
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
  locked: boolean('locked').notNull().default(false),          // fixed line excluded from solver
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
  // Per-step yield loss %; cumulative loss feeds final yield_pct unless user overrides
  lossPct: numeric('loss_pct', { precision: 6, scale: 4 }),
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
