// Which source note a nutrient value is saved with when editing an ingredient's nutrients.
// The "Source reference" box applies to values that are new or that you changed; untouched
// values keep the note they already had; values read from a document keep "Parsed from: …".

export type NutrientEditSource = {
  amount: string
  /** The note the value already has ('' for none) */
  sourceRef: string
  /** The stored amount when editing began; undefined for a value that didn't exist */
  originalAmount?: string
  /** Filled in by "Parse with AI" and not retyped since */
  fromParse?: boolean
}

export function nutrientSourceFor(edit: NutrientEditSource, globalSource: string): string {
  const global = globalSource.trim()
  if (edit.fromParse && edit.sourceRef) return edit.sourceRef
  const changed = edit.originalAmount === undefined || parseFloat(edit.amount) !== parseFloat(edit.originalAmount)
  if (changed && global) return global
  return edit.sourceRef || global
}
