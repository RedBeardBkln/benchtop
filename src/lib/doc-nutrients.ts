import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'
import { nutrients } from '@/lib/db/schema'
import { convertToUnit } from '@/lib/units'

// Reads nutrient values per 100 g from a spec sheet, nutrition facts panel or COA (PDF or image),
// matched to the nutrient list and stored in each nutrient's own unit. SERVER ONLY.

export const DOC_IMAGE_TYPES = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
} as const
export type DocImageType = (typeof DOC_IMAGE_TYPES)[keyof typeof DOC_IMAGE_TYPES]
export type DocMediaType = 'application/pdf' | DocImageType

/** The media type of a document from its content type or file extension; null when it can't be read */
export function docMediaType(contentType: string | null | undefined, fileName: string): DocMediaType | null {
  const types = Object.values(DOC_IMAGE_TYPES) as string[]
  if (contentType === 'application/pdf' || types.includes(contentType ?? '')) return contentType as DocMediaType
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return 'application/pdf'
  return DOC_IMAGE_TYPES[ext as keyof typeof DOC_IMAGE_TYPES] ?? null
}

export type DocNutrient = { nutrientId: string; name: string; unit: string; amountPer100g: number }

export class DocParseError extends Error {}

export async function extractNutrientsFromDoc(bytes: Buffer, mediaType: DocMediaType): Promise<DocNutrient[]> {
  const base64 = bytes.toString('base64')
  const allNutrients = await db
    .select({ id: nutrients.id, name: nutrients.name, unit: nutrients.unit })
    .from(nutrients)
    .orderBy(nutrients.displayOrder)

  const nutrientList = allNutrients.map(n => `${n.id}|${n.name}|${n.unit}`).join('\n')

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const docContent = mediaType === 'application/pdf'
    ? ({
        type: 'document' as const,
        source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 },
      })
    : ({
        type: 'image' as const,
        source: { type: 'base64' as const, media_type: mediaType, data: base64 },
      })

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          docContent,
          {
            type: 'text',
            text: `Extract all nutrient values from this food specification document, nutrition facts panel, or Certificate of Analysis.

All values must be expressed per 100 g of ingredient. If the document expresses values per serving, divide by the serving weight in grams and multiply by 100.

Match each nutrient to the list below using its exact UUID as nutrientId. Only use IDs from this list:
ID|Name|Unit
${nutrientList}

Return ONLY a valid JSON array with no surrounding text or markdown:
[{"nutrientId":"<uuid>","amountPer100g":<number>,"unit":"<unit of amountPer100g>"}]

Rules:
- Only include nutrients explicitly stated in the document
- If a value is given as "< X g", use X/2 as the estimate
- Exclude nutrients that are absent, trace, or not stated
- amountPer100g must be a non-negative finite number
- Express amountPer100g in the Unit listed for that nutrient, converting if the document uses another (1 g = 1,000 mg = 1,000,000 mcg; 1 mg = 1,000 mcg). Set "unit" to the unit your number is in.
- A percentage of the ingredient by weight is grams per 100 g (e.g. 0.2% vitamin K = 0.2 g = 200,000 mcg per 100 g)`,
          },
        ],
      },
    ],
  })

  const raw = message.content[0]?.type === 'text' ? message.content[0].text.trim() : ''

  let results: Array<{ nutrientId: string; amountPer100g: number; unit?: string }> = []
  try {
    const match = raw.match(/\[[\s\S]*\]/)
    results = match ? JSON.parse(match[0]) : []
  } catch {
    throw new DocParseError('Could not parse AI response')
  }

  const byId = new Map(allNutrients.map(n => [n.id, n]))
  return results
    .filter(
      r =>
        typeof r.nutrientId === 'string' &&
        byId.has(r.nutrientId) &&
        typeof r.amountPer100g === 'number' &&
        isFinite(r.amountPer100g) &&
        r.amountPer100g >= 0
    )
    // Belt and braces: if the model reported a different unit than the nutrient's, convert it
    .flatMap(r => {
      const n = byId.get(r.nutrientId)!
      const amount = typeof r.unit === 'string' && r.unit.trim()
        ? convertToUnit(r.amountPer100g, r.unit, n.unit)
        : r.amountPer100g
      return amount == null ? [] : [{ nutrientId: n.id, name: n.name, unit: n.unit, amountPer100g: amount }]
    })
}
