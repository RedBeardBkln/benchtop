import type Anthropic from '@anthropic-ai/sdk'
import type { AnthropicAi } from '@/lib/ai/access'
import { claudeJson } from '@/lib/ai-json'
import type { DocMediaType } from '@/lib/doc-nutrients'
import {
  INGREDIENT_CATEGORIES, SUBCATEGORY_EXAMPLES, canonicalTerm, categoryOptions, categoryPath,
  microCategoryOptions, subcategoryOptions, type TaxonomyEntry,
} from '@/lib/ingredient-categories'

// Reads an ingredient's identifying details (name, supplier, item code, …) from a spec sheet, COA or
// nutrition panel, to fill in the Add ingredient form. SERVER ONLY.

/** Every field is null when the document doesn't state it */
export type DocIngredientInfo = {
  name: string | null
  labelName: string | null
  brandName: string | null
  supplierName: string | null
  itemCode: string | null
  moisturePct: number | null
  densityGPerMl: number | null
  category: string | null
  subcategory: string | null
  microCategory: string | null
}

type Extracted = Record<keyof DocIngredientInfo, string> & { moisturePct: number; densityGPerMl: number }

const str = { type: 'string' }
const num = { type: 'number' }
const FIELDS = ['name', 'labelName', 'brandName', 'supplierName', 'itemCode', 'moisturePct', 'densityGPerMl', 'category', 'subcategory', 'microCategory'] as const

function schema(categories: string[]) {
  return {
    type: 'object',
    additionalProperties: false,
    required: [...FIELDS],
    properties: {
      name: str, labelName: str, brandName: str, supplierName: str, itemCode: str,
      moisturePct: num, densityGPerMl: num,
      category: { type: 'string', enum: [...categories, ''] },
      subcategory: str, microCategory: str,
    },
  }
}

/** Categories offered (standard ones with examples, then the team's own) and paths already in use */
function taxonomyGuide(taxonomy: TaxonomyEntry[]) {
  const categories = categoryOptions(taxonomy).filter(c => c.toLowerCase() !== 'other')
  const standard = new Set<string>(INGREDIENT_CATEGORIES)
  const examples: Record<string, string[]> = SUBCATEGORY_EXAMPLES
  const guide = categories
    .map(c => (standard.has(c)
      ? `- ${c}${examples[c]?.length ? ` (e.g. ${examples[c].join(', ')})` : ''}`
      : `- ${c} (added by this team)`))
    .join('\n')
  const paths = [...new Set(taxonomy.filter(t => t.category).map(categoryPath))].sort().slice(0, 300)
  return { categories, guide, paths }
}

function instructions(guide: string, paths: string[]) {
  return `This document is a food or supplement ingredient's specification sheet, Certificate of Analysis (COA), product data sheet or nutrition panel. Read the ingredient's identifying details so they can fill in a form that adds it to an ingredient library.

Return:
- name: the ingredient's product name as the document gives it, e.g. "Pea Protein Isolate 85%". Keep grade or strength words; leave out the brand and supplier. "" if not stated.
- labelName: the ingredient statement / declaration name to use on a product label, only if the document states one (e.g. "Ingredient statement: Pea protein"). Otherwise "".
- brandName: the product's trade or brand name, only if it differs from the supplier (e.g. "Supro" from Solae). Otherwise "".
- supplierName: the company that makes or sells the ingredient (manufacturer or distributor named on the document's letterhead or footer). Company name only, without "Inc.", addresses or phone numbers. "" if not stated.
- itemCode: the supplier's product code, item number, SKU, part number or material number. Not a lot or batch number. "" if not stated.
- moisturePct: moisture (or loss on drying) as a percentage, a number from 0 to 100. If a range or maximum is given (e.g. "≤ 7%"), use the typical value if stated, otherwise the maximum. -1 if not stated.
- densityGPerMl: density in grams per mL (convert from g/L or g/cm³; specific gravity equals g/mL). Bulk or tapped density counts. -1 if not stated.
- category: exactly one of the categories below, chosen by the ingredient's main function in a formulation. "" if none fits or the document doesn't make the material clear.
- subcategory: the material type or source within that category (e.g. Tapioca, Sunflower Lecithin, Xanthan, Whey). "" if unclear.
- microCategory: the form, grade or treatment when it matters (e.g. Native, Pregelatinized, Liquid, Powder, Isolate, Organic). "" when nothing further distinguishes it.

CATEGORIES:
${guide}

${paths.length ? `PATHS ALREADY IN USE (category › subcategory › micro category) — reuse these exact spellings when they fit:\n${paths.join('\n')}\n\n` : ''}Only report what the document states; never guess a supplier, code or value.`
}

const text = (s: string, max: number) => (s.trim() ? s.trim().slice(0, max) : null)

/** `ai` comes from getClaude(ctx, 'doc_nutrients'); the call's usage is recorded against the team's allowance. */
export async function extractIngredientInfoFromDoc(
  bytes: Buffer,
  mediaType: DocMediaType,
  taxonomy: TaxonomyEntry[],
  ai: AnthropicAi,
): Promise<DocIngredientInfo> {
  const data = bytes.toString('base64')
  const doc: Anthropic.Beta.BetaContentBlockParam = mediaType === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
    : { type: 'image', source: { type: 'base64', media_type: mediaType, data } }

  const { categories, guide, paths } = taxonomyGuide(taxonomy)
  const out = await claudeJson<Extracted>({
    ai,
    content: [doc, { type: 'text', text: instructions(guide, paths) }],
    schema: schema(categories),
    maxTokens: 4000,
    effort: 'low',
  })

  // In an existing spelling when one matches (ignoring case); a new subcategory or micro category is allowed
  const category = canonicalTerm(out.category, categories)
  const subcategory = category ? canonicalTerm(out.subcategory, subcategoryOptions(taxonomy, category)) : null
  const microCategory = category ? canonicalTerm(out.microCategory, microCategoryOptions(taxonomy, category, subcategory)) : null

  const moisture = out.moisturePct
  const density = out.densityGPerMl
  return {
    name: text(out.name, 255),
    labelName: text(out.labelName, 500),
    brandName: text(out.brandName, 255),
    supplierName: text(out.supplierName, 255),
    itemCode: text(out.itemCode, 100),
    moisturePct: Number.isFinite(moisture) && moisture >= 0 && moisture <= 100 ? moisture : null,
    densityGPerMl: Number.isFinite(density) && density > 0 && density <= 100 ? density : null,
    category,
    subcategory,
    microCategory,
  }
}
