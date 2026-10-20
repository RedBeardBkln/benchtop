import { NextRequest, NextResponse } from 'next/server'
import type Anthropic from '@anthropic-ai/sdk'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { intakeItems } from '@/lib/db/schema'
import { AiRefusalError, claudeJson } from '@/lib/ai-json'
import { INTAKE_UNITS, normalizeUnit } from '@/lib/ingredient-categories'

export const maxDuration = 120

type MediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

function toMediaType(mime: string): MediaType {
  if (mime === 'image/png') return 'image/png'
  if (mime === 'image/webp') return 'image/webp'
  if (mime === 'image/gif') return 'image/gif'
  return 'image/jpeg'
}

const MAX_PHOTOS = 10

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['labels'],
  properties: {
    labels: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['photo', 'name', 'quantity', 'unit'],
        properties: {
          photo: { type: 'integer', description: '1-based index of the photo this label is in' },
          name: { type: 'string', description: 'Material name exactly as written on the label; empty if unreadable' },
          quantity: { type: 'number', description: 'Net amount written on the label, or 0 if none' },
          unit: { type: 'string', enum: ['', ...INTAKE_UNITS] },
        },
      },
    },
  },
}

// Reads the name (and any written amount) off photos of container labels and adds each to the intake
// list. Only reads the text — identification and categorizing happen later for the whole list.
export async function POST(req: NextRequest) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  if (!process.env.ANTHROPIC_API_KEY)
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 })

  const formData = await req.formData().catch(() => null)
  if (!formData) return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })

  const files = formData.getAll('photo').filter((f): f is File => f instanceof File && f.type.startsWith('image/'))
  if (files.length === 0) return NextResponse.json({ error: 'Attach at least one photo' }, { status: 400 })
  if (files.length > MAX_PHOTOS) return NextResponse.json({ error: `At most ${MAX_PHOTOS} photos at a time` }, { status: 400 })

  const content: Anthropic.Beta.BetaContentBlockParam[] = []
  for (const [i, file] of files.entries()) {
    if (file.size > 12 * 1024 * 1024) return NextResponse.json({ error: 'Each photo must be under 12 MB' }, { status: 400 })
    content.push({ type: 'text', text: `Photo ${i + 1}:` })
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: toMediaType(file.type), data: Buffer.from(await file.arrayBuffer()).toString('base64') },
    })
  }
  content.push({
    type: 'text',
    text: `These are photos of containers in a food R&D lab. Most were repackaged and carry only a simple handwritten or printed label naming the material.

For each container label you can see, return the material name exactly as written (keep grades, percentages and codes such as "Oat Fiber 90" or "DE 10"; fix only obvious capitalization), and the net amount if one is written on the label (quantity + unit), otherwise quantity 0 and unit "". Ignore dates, initials and lot numbers. A photo may show more than one labeled container. Skip a label you cannot read rather than guessing.`,
  })

  try {
    const result = await claudeJson<{ labels: Array<{ photo: number; name: string; quantity: number; unit: string }> }>({
      content, schema, maxTokens: 4000, effort: 'low',
    })
    const values = result.labels
      .filter(l => l.name.trim())
      .map(l => {
        const unit = l.unit ? normalizeUnit(l.unit) : null
        const hasQty = unit != null && l.quantity > 0
        return {
          accountId: ctx.account.id,
          rawName: l.name.trim().slice(0, 255),
          quantity: hasQty ? l.quantity.toString() : null,
          quantityUnit: hasQty ? unit : null,
        }
      })
    if (values.length === 0) {
      return NextResponse.json({ error: 'No readable label found — try a closer, sharper photo or type the name' }, { status: 422 })
    }
    const rows = await db.insert(intakeItems).values(values).returning()
    return NextResponse.json(rows, { status: 201 })
  } catch (err) {
    if (err instanceof AiRefusalError) return NextResponse.json({ error: err.message }, { status: 422 })
    console.error('[intake/read-label]', err)
    return NextResponse.json({ error: 'Reading the label failed' }, { status: 500 })
  }
}
