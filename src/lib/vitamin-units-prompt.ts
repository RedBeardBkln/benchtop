// Prompt rules for AI nutrient extraction: vitamins given in IU or as a named form are reported as
// printed, in a unit convertToUnit (src/lib/units.ts) understands, so the conversion is done by code
// with the right factor for that vitamin and form rather than by the model.

export const VITAMIN_UNIT_RULES = `- Vitamins given in IU, or as a named form, are NOT converted: report the number as printed (still scaled to the requested basis) and set "unit" to exactly one of these:
  - Vitamin A: "IU" (retinol, retinyl acetate or palmitate, or form not stated); "IU beta-carotene" (beta-carotene in a supplement, premix or added as an ingredient); "IU dietary-beta-carotene" (beta-carotene naturally in a food); "mcg beta-carotene" or "mcg dietary-beta-carotene" when beta-carotene is given by weight; "mcg retinol" when retinol is given by weight. A value already in mcg RAE stays "mcg RAE".
  - Vitamin D (D2 or D3): "IU".
  - Vitamin E: "IU natural" (d-alpha-tocopherol, RRR); "IU synthetic" (dl-alpha-tocopherol, all-rac); "IU" when the form isn't stated; "mg synthetic" for mg of dl-alpha-tocopherol. A value in mg alpha-tocopherol or natural vitamin E stays "mg".
  - Folate: "mcg folic-acid" when the amount is folic acid rather than mcg DFE or food folate.
- Name the form only when the document says it; never guess it.`
