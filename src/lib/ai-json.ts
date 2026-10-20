import Anthropic from '@anthropic-ai/sdk'

export const AI_MODEL = 'claude-opus-5-5'

export class AiRefusalError extends Error {}

/**
 * One Claude call whose reply is constrained to `schema` (structured outputs), parsed and returned.
 * A safety decline is retried once on the fallback model server-side; if that also declines,
 * AiRefusalError is thrown.
 */
export async function claudeJson<T>(opts: {
  content: string | Anthropic.Beta.BetaContentBlockParam[]
  schema: Record<string, unknown>
  maxTokens?: number
  effort?: 'low' | 'medium' | 'high'
}): Promise<T> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const message = await client.beta.messages.stream({
    model: AI_MODEL,
    max_tokens: opts.maxTokens ?? 32000,
    betas: ['server-side-fallback-2026-06-01'],
    fallbacks: [{ model: 'claude-opus-5' }],
    output_config: {
      effort: opts.effort ?? 'medium',
      format: { type: 'json_schema', schema: opts.schema },
    },
    messages: [{ role: 'user', content: opts.content }],
  }).finalMessage()

  if (message.stop_reason === 'refusal') throw new AiRefusalError('Claude declined this request')
  if (message.stop_reason === 'max_tokens') throw new Error('Claude response was cut off; try fewer items at once')
  const text = message.content.flatMap(b => (b.type === 'text' ? [b.text] : [])).join('')
  return JSON.parse(text) as T
}
