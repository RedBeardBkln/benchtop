// Nutrient names as AI extraction or a label may write them → the library's nutrient names.
// Anything not listed is passed through (trimmed) and matched ignoring case.
const ALIASES: Record<string, string> = {
  'sugars': 'Total Sugars',
  'sugar': 'Total Sugars',
  'total sugar': 'Total Sugars',
  'added sugar': 'Added Sugars',
  'calories': 'Energy',
  'energy (kcal)': 'Energy',
  'fat': 'Total Fat',
  'carbohydrate': 'Total Carbohydrate',
  'carbohydrates': 'Total Carbohydrate',
  'total carbohydrates': 'Total Carbohydrate',
  'fiber': 'Dietary Fiber',
  'fibre': 'Dietary Fiber',
  'dietary fibre': 'Dietary Fiber',
  'total dietary fiber': 'Dietary Fiber',
}

export function canonicalNutrientName(name: string): string {
  const trimmed = name.trim()
  return ALIASES[trimmed.toLowerCase()] ?? trimmed
}
