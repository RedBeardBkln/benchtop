import type { InferSelectModel } from 'drizzle-orm'
import type {
  ingredients,
  ingredientNutrients,
  ingredientAllergens,
  ingredientCerts,
  ingredientDocs,
  subIngredients,
  nutrients,
  projects,
  formulations,
  formulationLines,
  processSteps,
  suppliers,
  ingredientSuppliers,
} from '@/lib/db/schema'

export type Ingredient = InferSelectModel<typeof ingredients>
export type IngredientNutrient = InferSelectModel<typeof ingredientNutrients>
export type Nutrient = InferSelectModel<typeof nutrients>

export type IngredientWithCounts = Ingredient & {
  nutrientCount: number
  allergenCount: number
  certCount: number
}

export type SubIngredient = InferSelectModel<typeof subIngredients>

export type IngredientDetail = Ingredient & {
  nutrients: Array<IngredientNutrient & { nutrient: Nutrient }>
  allergens: InferSelectModel<typeof ingredientAllergens>[]
  certs: InferSelectModel<typeof ingredientCerts>[]
  subIngredients: SubIngredient[]
  docs: InferSelectModel<typeof ingredientDocs>[]
  formulations: Array<{ formulationId: string; formulationName: string; projectId: string; projectName: string }>
  suppliers: IngredientSupplierWithName[]
}

export type IngredientListRow = Ingredient & { formulationCount: number }

export type Supplier = InferSelectModel<typeof suppliers>
export type IngredientSupplier = InferSelectModel<typeof ingredientSuppliers>
export type IngredientSupplierWithName = IngredientSupplier & { supplierName: string; supplierWebsiteUrl: string | null }

// Project + Formulation types
export type Project = InferSelectModel<typeof projects>
export type Formulation = InferSelectModel<typeof formulations>
export type FormulationLine = InferSelectModel<typeof formulationLines>
export type ProcessStep = InferSelectModel<typeof processSteps>

export type ProjectSummary = Project & { formulationCount: number }

export type FormulationLineDetail = FormulationLine & {
  ingredientName: string
  ingredientVerification: string
  nutrients: Array<{
    nutrientId: string
    amountPer100g: string
    name: string
    unit: string
    category: string
  }>
}

export type ProjectTarget = {
  nutrient: string | null
  label: string
  comparator: '<=' | '>=' | '=' | 'range'
  value: number
  valueMax?: number
  unit: string
  basis: 'per_serving' | 'per_100g'
  servingSizeG?: number   // reference serving size for per_serving targets
}

export type FormulationDetail = Formulation & {
  lines: FormulationLineDetail[]
  processSteps: ProcessStep[]
  project: { id: string; name: string; targets: ProjectTarget[] }
}

// USDA FoodData Central types
export type FdcFood = {
  fdcId: number
  description: string
  dataType: string
  brandOwner?: string
  brandName?: string
  foodNutrients?: FdcFoodNutrient[]
  publicationDate?: string
}

export type FdcFoodNutrient = {
  // full individual-endpoint shape
  nutrient?: {
    id: number
    number: string
    name: string
    unitName: string
  }
  amount?: number
  // abridged shape (POST /foods & search results): flat, number is integer
  number?: number
  name?: string
  // SR Legacy shape
  nutrientId?: number
  nutrientName?: string
  nutrientNumber?: string
  unitName?: string
  value?: number
}

export type FdcSearchResult = {
  foods: FdcFood[]
  totalHits: number
  currentPage: number
  totalPages: number
}
