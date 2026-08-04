import { pgEnum } from 'drizzle-orm/pg-core'

export const sourceTypeEnum = pgEnum('source_type', ['usda', 'supplier', 'manual', 'ai_extracted'])
export const verificationEnum = pgEnum('verification_status', ['verified', 'unverified'])
export const formulationModeEnum = pgEnum('formulation_mode', ['ground_up', 'reverse'])
export const formulationStatusEnum = pgEnum('formulation_status', ['draft', 'locked'])
export const reverseCandidateStatusEnum = pgEnum('reverse_candidate_status', ['pending', 'selected', 'rejected'])
export const projectStatusEnum = pgEnum('project_status', ['active', 'archived'])
export const targetBasisEnum = pgEnum('target_basis', ['per_serving', 'per_100g'])
export const nutrientCategoryEnum = pgEnum('nutrient_category', ['macros', 'vitamins', 'minerals', 'other'])
