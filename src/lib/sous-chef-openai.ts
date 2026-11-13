import OpenAI from 'openai'
import type Anthropic from '@anthropic-ai/sdk'
import type { TokenUsage } from '@/lib/ai/pricing'
import type { OpenAiAi } from '@/lib/ai/access'
import { MAX_ROUNDS, type SousChefEvent } from '@/lib/sous-chef'
import type { runSousChefTool } from '@/lib/sous-chef-server'

// Sous Chef's conversation on a team's own OpenAI key: the same tools and events as the Claude loop
// in app/api/sous-chef/chat, on the Responses API. The pure adapters below are unit-tested; the
// tools and their runner are passed in, so this file never touches the database itself.

/**
 * Sous Chef's Claude tool list as OpenAI tools: each custom tool becomes a function tool with the
 * same name, description and JSON schema, and Claude's web search becomes OpenAI's built-in one.
 * Not strict: strict mode needs every property required, and several tool inputs are optional.
 */
export function toOpenAiTools(tools: Anthropic.Beta.BetaToolUnion[]): OpenAI.Responses.Tool[] {
  return tools.flatMap((t): OpenAI.Responses.Tool[] => {
    if ('input_schema' in t && t.input_schema) {
      const tool = t as Anthropic.Beta.BetaTool
      return [{ type: 'function', name: tool.name, description: tool.description ?? null, parameters: tool.input_schema as Record<string, unknown>, strict: false }]
    }
    if ('type' in t && typeof t.type === 'string' && t.type.startsWith('web_search')) return [{ type: 'web_search' }]
    return []
  })
}

/** A function call as the tool_use block runSousChefTool takes; bad JSON arguments fail its validation */
export function toToolUse(call: Pick<OpenAI.Responses.ResponseFunctionToolCall, 'call_id' | 'name' | 'arguments'>) {
  let input: unknown
  try { input = JSON.parse(call.arguments || '{}') } catch { input = undefined }
  return { id: call.call_id, name: call.name, input }
}

/** runSousChefTool's tool_result block as a function_call_output item (OpenAI has no error flag, so errors say so) */
export function toFunctionCallOutput(result: Anthropic.Beta.BetaToolResultBlockParam): OpenAI.Responses.ResponseInputItem.FunctionCallOutput {
  const content = typeof result.content === 'string'
    ? result.content
    : (result.content ?? []).map(b => (b.type === 'text' ? b.text : JSON.stringify(b))).join('\n')
  return { type: 'function_call_output', call_id: result.tool_use_id, output: result.is_error ? `Error: ${content}` : content }
}

/**
 * One response's usage in our terms. OpenAI's input_tokens includes both cached reads and cache
 * writes, so those are taken out to leave plain input (as Claude reports it). Web searches come from
 * the response's billable count, or failing that the search calls in its output.
 */
export function fromOpenAiUsage(response: Pick<OpenAI.Responses.Response, 'output'> & Partial<Pick<OpenAI.Responses.Response, 'usage' | 'tool_usage'>>): TokenUsage {
  const u = response.usage
  const cacheRead = u?.input_tokens_details?.cached_tokens ?? 0
  const cacheWrite = u?.input_tokens_details?.cache_write_tokens ?? 0
  const searches = response.tool_usage?.web_search?.num_requests
    ?? response.output.filter(i => i.type === 'web_search_call' && i.action?.type === 'search').length
  return {
    inputTokens: Math.max(0, (u?.input_tokens ?? 0) - cacheRead - cacheWrite),
    outputTokens: u?.output_tokens ?? 0,
    cacheReadTokens: cacheRead,
    cacheWriteTokens: cacheWrite,
    webSearches: searches,
  }
}

/** The chat label for a web search call */
export function webSearchLabel(item: OpenAI.Responses.ResponseFunctionWebSearch): string {
  const q = item.action?.type === 'search' ? (item.action.query ?? item.action.queries?.[0]) : undefined
  return q ? `Searched the web for “${q}”` : 'Searched the web'
}

/** What to tell the user when the OpenAI call fails, or null for the generic message */
export function openAiErrorMessage(err: unknown): string | null {
  if (err instanceof OpenAI.RateLimitError) return 'Sous Chef is busy right now, or your team’s OpenAI account is out of credit. Try again in a minute.'
  if (err instanceof OpenAI.AuthenticationError || err instanceof OpenAI.PermissionDeniedError)
    return 'OpenAI didn’t accept your team’s key. An owner or admin can check it in Settings › AI.'
  if (err instanceof OpenAI.NotFoundError) return 'OpenAI couldn’t find the model chosen for your team. An owner or admin can pick another in Settings › AI.'
  return null
}

export async function runOpenAiConversation(opts: {
  ai: OpenAiAi
  instructions: string
  history: { role: 'user' | 'assistant'; content: string }[]
  tools: Anthropic.Beta.BetaToolUnion[]
  runTool: (block: { id: string; name: string; input: unknown }) => ReturnType<typeof runSousChefTool>
  send: (e: SousChefEvent) => void
  logActivity: (label: string) => void
  /** Each round's reply text is pushed here, as in the Claude loop */
  parts: string[]
}): Promise<void> {
  const { ai, send, logActivity, parts } = opts
  const client = new OpenAI({ apiKey: ai.apiKey })
  const tools = toOpenAiTools(opts.tools)
  const input: OpenAI.Responses.ResponseInputItem[] = opts.history.map(t => ({ role: t.role, content: t.content }))

  for (let round = 0; round < MAX_ROUNDS; round++) {
    // Keep separate rounds' text apart in the chat
    let first = true
    const stream = await client.responses.create({
      model: ai.model,
      instructions: opts.instructions,
      input,
      tools,
      reasoning: { effort: 'medium' },
      // Matches Claude's web search limit of 5 per request
      max_tool_calls: 5,
      // Nothing kept at OpenAI: the whole conversation is sent each round, reasoning included (encrypted)
      store: false,
      include: ['reasoning.encrypted_content'],
      stream: true,
    })

    let response: OpenAI.Responses.Response | null = null
    for await (const event of stream) {
      switch (event.type) {
        case 'response.output_text.delta':
          if (first && parts.length > 0) send({ type: 'text', text: '\n\n' })
          first = false
          send({ type: 'text', text: event.delta })
          break
        case 'response.output_item.done':
          if (event.item.type === 'web_search_call') logActivity(webSearchLabel(event.item))
          break
        case 'response.completed':
        case 'response.incomplete':
          response = event.response
          break
        case 'response.failed':
          throw new Error(`OpenAI response failed: ${event.response.error?.code ?? ''} ${event.response.error?.message ?? ''}`.trim())
        case 'error':
          throw new Error(`OpenAI stream error: ${event.code ?? ''} ${event.message}`.trim())
      }
    }
    if (!response) throw new Error('OpenAI stream ended without a response')
    await ai.record(response.model, fromOpenAiUsage(response))

    const messages = response.output.filter((i): i is OpenAI.Responses.ResponseOutputMessage => i.type === 'message')
    const text = messages.flatMap(m => m.content.flatMap(c => (c.type === 'output_text' ? [c.text] : []))).join('')
    if (text) parts.push(text)

    const refused = messages.some(m => m.content.some(c => c.type === 'refusal'))
      || response.incomplete_details?.reason === 'content_filter'
    if (refused) {
      const msg = 'Sous Chef can’t help with that request.'
      parts.push(msg)
      send({ type: 'text', text: `${text ? '\n\n' : ''}${msg}` })
      break
    }

    const calls = response.output.filter((i): i is OpenAI.Responses.ResponseFunctionToolCall => i.type === 'function_call')
    if (response.status === 'incomplete' || calls.length === 0) {
      if (response.incomplete_details?.reason === 'max_output_tokens') send({ type: 'text', text: '\n\n_(The reply was cut off.)_' })
      break
    }

    // The model's output (reasoning, searches, calls) goes back in ahead of the tool results
    input.push(...(response.output as OpenAI.Responses.ResponseInputItem[]))
    // One at a time, as in the Claude loop (database connections)
    for (const call of calls) {
      const r = await opts.runTool(toToolUse(call))
      if (r.label) logActivity(r.label)
      input.push(toFunctionCallOutput(r.result))
    }
  }
}
