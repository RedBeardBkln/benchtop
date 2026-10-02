export type PrintSection = 'formulation' | 'process' | 'nutrients' | 'validation'

/** Fixed print order, regardless of the order tokens appear in the URL. */
export const PRINT_SECTION_ORDER: readonly PrintSection[] = [
  'formulation',
  'process',
  'nutrients',
  'validation',
]

/** What prints when no (or no valid) selection is given. */
export const DEFAULT_PRINT_SECTIONS: PrintSection[] = ['formulation', 'process']

/**
 * Parse the `?sections=` query value. Accepts a comma-separated string (or the
 * first element of an array, as Next gives for repeated params), ignores
 * unknown tokens and duplicates, and returns sections in print order. Falls
 * back to the defaults when nothing valid is present.
 */
export function parsePrintSections(raw: string | string[] | undefined): PrintSection[] {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value) return [...DEFAULT_PRINT_SECTIONS]
  const tokens = new Set(value.split(',').map(s => s.trim().toLowerCase()))
  const sections = PRINT_SECTION_ORDER.filter(s => tokens.has(s))
  return sections.length > 0 ? sections : [...DEFAULT_PRINT_SECTIONS]
}

export function serializePrintSections(sections: PrintSection[]): string {
  return PRINT_SECTION_ORDER.filter(s => sections.includes(s)).join(',')
}
