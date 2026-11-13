import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApi } from '@/lib/auth/context'
import { listOpenAiModels, OPENAI_DEFAULT_MODEL } from '@/lib/ai/openai'

// Owners and admins: check an OpenAI key and list the models it can use, so one can be chosen
// before the key is saved. The key isn't stored here.

const bodySchema = z.object({ apiKey: z.string().trim().min(20).max(400) })

export async function POST(req: NextRequest) {
  const auth = await requireApi({ allowUnentitled: true, teamAdmin: true })
  if (!auth.ok) return auth.res

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid API key' }, { status: 400 })

  try {
    const models = await listOpenAiModels(parsed.data.apiKey)
    return NextResponse.json({ models, suggested: models.includes(OPENAI_DEFAULT_MODEL) ? OPENAI_DEFAULT_MODEL : models[0] ?? null })
  } catch (e) {
    const status = (e as { status?: number })?.status
    return NextResponse.json({
      error: status === 401 || status === 403
        ? 'OpenAI didn’t accept that key. Check it and try again.'
        : 'Couldn’t check the key with OpenAI right now. Try again in a minute.',
    }, { status: 400 })
  }
}
