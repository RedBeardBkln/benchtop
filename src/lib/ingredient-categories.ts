// Ingredient library taxonomy: Category > Subcategory > Micro category.
//
// Categories are a fixed list so filters and on-hand matching stay consistent. Subcategory and micro
// category are free text (Claude reuses the ones already in the library); the examples here guide it.
//   Starches > Tapioca > Native        Emulsifiers > Sunflower Lecithin > Liquid

export const INGREDIENT_CATEGORIES = [
  'Acids & Acidulants',
  'Antioxidants & Preservatives',
  'Colors',
  'Dairy & Eggs',
  'Emulsifiers',
  'Enzymes & Cultures',
  'Fats & Oils',
  'Fibers',
  'Flavors & Extracts',
  'Flours & Grains',
  'Fruits & Vegetables',
  'Herbs & Spices',
  'Hydrocolloids & Gums',
  'Leavening Agents',
  'Minerals & Salts',
  'Nuts & Seeds',
  'Proteins',
  'Starches',
  'Sweeteners',
  'Vitamins & Supplements',
  'Other',
] as const

export type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number]

/** Typical subcategories per category, shown to Claude as a guide (not an exhaustive list). */
export const SUBCATEGORY_EXAMPLES: Record<IngredientCategory, string[]> = {
  'Acids & Acidulants': ['Citric Acid', 'Malic Acid', 'Lactic Acid', 'Phosphoric Acid'],
  'Antioxidants & Preservatives': ['Tocopherols', 'Rosemary Extract', 'Sorbates', 'Benzoates'],
  'Colors': ['Natural Colors', 'Synthetic Colors'],
  'Dairy & Eggs': ['Milk Powder', 'Cheese', 'Egg Products', 'Cultured Dairy'],
  'Emulsifiers': ['Sunflower Lecithin', 'Soy Lecithin', 'Mono- & Diglycerides', 'Polysorbates'],
  'Enzymes & Cultures': ['Enzymes', 'Probiotics', 'Starter Cultures'],
  'Fats & Oils': ['Vegetable Oils', 'Tropical Fats', 'Butter & Dairy Fats', 'Oil Powders'],
  'Fibers': ['Inulin', 'Citrus Fiber', 'Oat Fiber', 'Psyllium'],
  'Flavors & Extracts': ['Natural Flavors', 'Vanilla', 'Cocoa', 'Botanical Extracts'],
  'Flours & Grains': ['Wheat', 'Oat', 'Rice', 'Gluten-Free Flours'],
  'Fruits & Vegetables': ['Fruit Powders', 'Purees', 'Dried Fruit', 'Vegetable Powders'],
  'Herbs & Spices': ['Spices', 'Herbs', 'Seasoning Blends'],
  'Hydrocolloids & Gums': ['Xanthan', 'Guar', 'Gellan', 'Pectin', 'Carrageenan', 'Agar', 'Cellulose'],
  'Leavening Agents': ['Baking Soda', 'Leavening Acids', 'Yeast'],
  'Minerals & Salts': ['Sodium Chloride', 'Calcium Salts', 'Magnesium Salts', 'Potassium Salts'],
  'Nuts & Seeds': ['Tree Nuts', 'Peanuts', 'Seeds', 'Nut Butters'],
  'Proteins': ['Whey', 'Casein', 'Pea Protein', 'Soy Protein', 'Collagen'],
  'Starches': ['Tapioca', 'Corn', 'Potato', 'Rice', 'Modified Starch'],
  'Sweeteners': ['Sugars', 'Syrups', 'Polyols', 'High-Intensity', 'Rare Sugars'],
  'Vitamins & Supplements': ['Vitamins', 'Minerals', 'Botanicals', 'Amino Acids'],
  'Other': [],
}

export function isIngredientCategory(v: unknown): v is IngredientCategory {
  return typeof v === 'string' && (INGREDIENT_CATEGORIES as readonly string[]).includes(v)
}

/** "Starches › Tapioca › Native", skipping empty levels; '' when uncategorized. */
export function categoryPath(c: { category?: string | null; subcategory?: string | null; microCategory?: string | null }): string {
  return [c.category, c.subcategory, c.microCategory].filter(s => s && s.trim()).join(' › ')
}

// ── Quantities ────────────────────────────────────────────────────────────────

export const INTAKE_UNITS = ['g', 'kg', 'mg', 'lb', 'oz', 'mL', 'L', 'gal', 'each'] as const
export type IntakeUnit = (typeof INTAKE_UNITS)[number]

const GRAMS_PER: Partial<Record<IntakeUnit, number>> = {
  mg: 0.001, g: 1, kg: 1000, lb: 453.59237, oz: 28.349523125,
}

/** Mass quantity in grams; null for volumes and counts (no density is known for an unidentified jar). */
export function quantityToGrams(quantity: number, unit: string): number | null {
  const f = GRAMS_PER[unit as IntakeUnit]
  return f == null ? null : quantity * f
}

const UNIT_ALIASES: Record<string, IntakeUnit> = {
  g: 'g', gr: 'g', gram: 'g', grams: 'g',
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg',
  mg: 'mg',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb', '#': 'lb',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  ml: 'mL', l: 'L', liter: 'L', liters: 'L', litre: 'L', litres: 'L',
  gal: 'gal', gallon: 'gal', gallons: 'gal',
  ea: 'each', each: 'each', pc: 'each', pcs: 'each', bag: 'each', bags: 'each', jar: 'each', jars: 'each',
}

export function normalizeUnit(raw: string): IntakeUnit | null {
  return UNIT_ALIASES[raw.trim().toLowerCase()] ?? null
}

export type ParsedIntakeLine = { rawName: string; quantity: number | null; quantityUnit: IntakeUnit | null }

/**
 * One typed or pasted line → name + optional trailing quantity.
 * "Tapioca starch 2 kg", "Sunflower lecithin, 500g", "- Xanthan gum (1.5 lb)" all work; a number that
 * isn't followed by a known unit stays part of the name ("Oat Fiber 90").
 */
export function parseIntakeLine(line: string): ParsedIntakeLine | null {
  const s = line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim()
  if (!s) return null
  const m = s.match(/^(.*?)[\s,;:–-]*\(?\s*(\d+(?:\.\d+)?)\s*([a-zA-Z#]+)\s*\)?\s*$/)
  if (m && m[1].trim()) {
    const unit = normalizeUnit(m[3])
    if (unit) return { rawName: m[1].trim(), quantity: parseFloat(m[2]), quantityUnit: unit }
  }
  return { rawName: s, quantity: null, quantityUnit: null }
}

/** Every non-empty line of a paste, parsed. */
export function parseIntakeLines(text: string): ParsedIntakeLine[] {
  return text.split(/\r?\n/).map(parseIntakeLine).filter((l): l is ParsedIntakeLine => l !== null)
}

// ── On-hand matching ──────────────────────────────────────────────────────────

export type CategorizedIngredient = {
  id: string
  name: string
  category: string | null
  subcategory: string | null
  microCategory: string | null
  onHand: boolean
}

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()

/**
 * On-hand library ingredients that could stand in for `target`, best first: same subcategory (and micro
 * category) before same category only. Empty when the target is on hand itself or uncategorized.
 */
export function onHandAlternatives<T extends CategorizedIngredient>(target: CategorizedIngredient, library: T[], limit = 5): T[] {
  if (target.onHand || !target.category || target.category === 'Other') return []
  const cat = norm(target.category)
  const sub = norm(target.subcategory)
  const micro = norm(target.microCategory)
  const score = (c: T) => {
    if (sub && norm(c.subcategory) === sub) return micro && norm(c.microCategory) === micro ? 3 : 2
    return 1
  }
  return library
    .filter(c => c.onHand && c.id !== target.id && norm(c.category) === cat)
    .map(c => ({ c, s: score(c) }))
    .sort((a, b) => b.s - a.s || a.c.name.localeCompare(b.c.name))
    .slice(0, limit)
    .map(x => x.c)
}
