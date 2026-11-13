import OpenAI from 'openai'

// OpenAI pieces for teams that bring their own OpenAI key (Sous Chef only).

/**
 * Used when a team's OpenAI key has no model chosen. GPT-6.1 Sol: OpenAI's docs describe it as
 * near GPT-6 Astra for complex work at a fifth of the price, with function calling and web search
 * on the Responses API. The team pays for it on its own key, so the cheaper of the two strong models.
 */
export const OPENAI_DEFAULT_MODEL = 'gpt-6.1-sol'

// Models that aren't for a chat with tools: media, speech, embeddings, moderation and the like
const NOT_CHAT = /(image|audio|realtime|transcribe|tts|whisper|embedding|moderation|search|live|instruct|codex|cyber|computer|dall-e|babbage|davinci)/

/**
 * Whether a model id suits Sous Chef: the GPT-5 generation onward and the o3/o4 reasoning models,
 * all of which take reasoning effort, function tools and web search on the Responses API.
 * Older chat models (GPT-4 and before) are left out.
 */
export function isChatModelId(id: string): boolean {
  if (NOT_CHAT.test(id)) return false
  const gpt = /^gpt-(\d+)/.exec(id)
  if (gpt) return Number(gpt[1]) >= 5
  return /^o[34](-|$)/.test(id)
}

/** The account's models that suit Sous Chef, sorted. Throws if OpenAI refuses the key. */
export async function listOpenAiModels(apiKey: string): Promise<string[]> {
  const client = new OpenAI({ apiKey, maxRetries: 1, timeout: 20_000 })
  const ids: string[] = []
  for await (const model of client.models.list()) ids.push(model.id)
  return [...new Set(ids.filter(isChatModelId))].sort()
}
