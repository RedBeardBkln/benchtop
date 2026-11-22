/** The allergens offered as one-click buttons on an ingredient; anything else is saved as a custom allergen. */
export const STANDARD_ALLERGENS = [
  'Milk', 'Eggs', 'Fish', 'Shellfish', 'Tree Nuts',
  'Peanuts', 'Wheat', 'Soy', 'Sesame', 'Gluten',
]

/** Older names for a standard allergen, so typed or AI-read values match its button ("Soybeans" was renamed "Soy"). */
const ALIASES: Record<string, string> = {
  soy: 'Soy',
  soya: 'Soy',
  soybean: 'Soy',
  soybeans: 'Soy',
}

/** The standard spelling of an allergen name, or the trimmed name unchanged when it isn't a known alias. */
export function canonicalAllergen(name: string): string {
  const trimmed = name.trim()
  return ALIASES[trimmed.toLowerCase()] ?? trimmed
}
