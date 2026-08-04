import { relations } from 'drizzle-orm'

// ---- Enums ----
export * from './enums'

// ---- Tables ----
export * from './nutrients'
export * from './ingredients'
export * from './suppliers'
export * from './projects'
export * from './formulations'
export * from './reverse'
export * from './audit'

// ---- Import tables for relations ----
import { nutrients } from './nutrients'
import {
  ingredients,
  ingredientNutrients,
  ingredientAllergens,
  ingredientCerts,
  subIngredients,
  ingredientDocs,
} from './ingredients'
import { suppliers, ingredientSuppliers } from './suppliers'
import { projects } from './projects'
import {
  formulations,
  formulationLines,
  processSteps,
  formulationTargets,
} from './formulations'
import { reverseTargets, reverseCandidates } from './reverse'

// ---- Relations ----

export const nutrientsRelations = relations(nutrients, ({ many }) => ({
  ingredientNutrients: many(ingredientNutrients),
  formulationTargets: many(formulationTargets),
}))

export const ingredientsRelations = relations(ingredients, ({ many }) => ({
  nutrients: many(ingredientNutrients),
  allergens: many(ingredientAllergens),
  certs: many(ingredientCerts),
  subIngredients: many(subIngredients),
  docs: many(ingredientDocs),
  formulationLines: many(formulationLines),
  reverseCandidates: many(reverseCandidates),
  ingredientSuppliers: many(ingredientSuppliers),
}))

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  ingredientSuppliers: many(ingredientSuppliers),
}))

export const ingredientSuppliersRelations = relations(ingredientSuppliers, ({ one }) => ({
  ingredient: one(ingredients, {
    fields: [ingredientSuppliers.ingredientId],
    references: [ingredients.id],
  }),
  supplier: one(suppliers, {
    fields: [ingredientSuppliers.supplierId],
    references: [suppliers.id],
  }),
}))

export const ingredientNutrientsRelations = relations(ingredientNutrients, ({ one }) => ({
  ingredient: one(ingredients, {
    fields: [ingredientNutrients.ingredientId],
    references: [ingredients.id],
  }),
  nutrient: one(nutrients, {
    fields: [ingredientNutrients.nutrientId],
    references: [nutrients.id],
  }),
}))

export const ingredientAllergyRelations = relations(ingredientAllergens, ({ one }) => ({
  ingredient: one(ingredients, {
    fields: [ingredientAllergens.ingredientId],
    references: [ingredients.id],
  }),
}))

export const ingredientCertsRelations = relations(ingredientCerts, ({ one }) => ({
  ingredient: one(ingredients, {
    fields: [ingredientCerts.ingredientId],
    references: [ingredients.id],
  }),
  evidenceDoc: one(ingredientDocs, {
    fields: [ingredientCerts.evidenceDocId],
    references: [ingredientDocs.id],
  }),
}))

export const subIngredientsRelations = relations(subIngredients, ({ one }) => ({
  ingredient: one(ingredients, {
    fields: [subIngredients.ingredientId],
    references: [ingredients.id],
  }),
}))

export const ingredientDocsRelations = relations(ingredientDocs, ({ one }) => ({
  ingredient: one(ingredients, {
    fields: [ingredientDocs.ingredientId],
    references: [ingredients.id],
  }),
}))

export const projectsRelations = relations(projects, ({ many }) => ({
  formulations: many(formulations),
  reverseTargets: many(reverseTargets),
}))

export const formulationsRelations = relations(formulations, ({ one, many }) => ({
  project: one(projects, {
    fields: [formulations.projectId],
    references: [projects.id],
  }),
  parent: one(formulations, {
    fields: [formulations.parentFormulationId],
    references: [formulations.id],
    relationName: 'formulation_iterations',
  }),
  children: many(formulations, { relationName: 'formulation_iterations' }),
  lines: many(formulationLines),
  processSteps: many(processSteps),
  targets: many(formulationTargets),
}))

export const formulationLinesRelations = relations(formulationLines, ({ one }) => ({
  formulation: one(formulations, {
    fields: [formulationLines.formulationId],
    references: [formulations.id],
  }),
  ingredient: one(ingredients, {
    fields: [formulationLines.ingredientId],
    references: [ingredients.id],
  }),
}))

export const processStepsRelations = relations(processSteps, ({ one }) => ({
  formulation: one(formulations, {
    fields: [processSteps.formulationId],
    references: [formulations.id],
  }),
}))

export const formulationTargetsRelations = relations(formulationTargets, ({ one }) => ({
  formulation: one(formulations, {
    fields: [formulationTargets.formulationId],
    references: [formulations.id],
  }),
  nutrient: one(nutrients, {
    fields: [formulationTargets.nutrientId],
    references: [nutrients.id],
  }),
}))

export const reverseTargetsRelations = relations(reverseTargets, ({ one, many }) => ({
  project: one(projects, {
    fields: [reverseTargets.projectId],
    references: [projects.id],
  }),
  candidates: many(reverseCandidates),
}))

export const reverseCandidatesRelations = relations(reverseCandidates, ({ one }) => ({
  reverseTarget: one(reverseTargets, {
    fields: [reverseCandidates.reverseTargetId],
    references: [reverseTargets.id],
  }),
  ingredient: one(ingredients, {
    fields: [reverseCandidates.candidateIngredientId],
    references: [ingredients.id],
  }),
}))
