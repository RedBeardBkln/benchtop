import { describe, expect, it } from 'vitest'
import type OpenAI from 'openai'
import type Anthropic from '@anthropic-ai/sdk'
import { fromOpenAiUsage, toFunctionCallOutput, toOpenAiTools, toToolUse, webSearchLabel } from './sous-chef-openai'
import { isChatModelId } from './ai/openai'

const schema = { type: 'object', properties: { includeArchived: { type: 'boolean' } }, additionalProperties: false } as const

describe('toOpenAiTools', () => {
  it('turns custom tools into function tools and web search into OpenAI’s', () => {
    const tools: Anthropic.Beta.BetaToolUnion[] = [
      { name: 'list_projects', description: 'List projects', input_schema: schema },
      { type: 'web_search_20260209', name: 'web_search', max_uses: 5 },
    ]
    expect(toOpenAiTools(tools)).toEqual([
      { type: 'function', name: 'list_projects', description: 'List projects', parameters: schema, strict: false },
      { type: 'web_search' },
    ])
  })
})

describe('tool call adapters', () => {
  it('parses arguments, and leaves bad JSON for validation to reject', () => {
    expect(toToolUse({ call_id: 'c1', name: 'x', arguments: '{"a":1}' })).toEqual({ id: 'c1', name: 'x', input: { a: 1 } })
    expect(toToolUse({ call_id: 'c1', name: 'x', arguments: '' }).input).toEqual({})
    expect(toToolUse({ call_id: 'c1', name: 'x', arguments: '{oops' }).input).toBeUndefined()
  })
  it('turns tool results into function call outputs, marking errors', () => {
    expect(toFunctionCallOutput({ type: 'tool_result', tool_use_id: 'c1', content: '[1]' }))
      .toEqual({ type: 'function_call_output', call_id: 'c1', output: '[1]' })
    expect(toFunctionCallOutput({ type: 'tool_result', tool_use_id: 'c2', is_error: true, content: 'Unknown tool' }))
      .toEqual({ type: 'function_call_output', call_id: 'c2', output: 'Error: Unknown tool' })
  })
})

describe('fromOpenAiUsage', () => {
  it('takes cached reads and cache writes out of input tokens', () => {
    const usage = {
      input_tokens: 12000, output_tokens: 500, total_tokens: 12500,
      input_tokens_details: { cached_tokens: 4000, cache_write_tokens: 7000 },
      output_tokens_details: { reasoning_tokens: 100 },
    }
    const search = { id: 's', type: 'web_search_call', status: 'completed', action: { type: 'search', query: 'gellan' } } as const
    expect(fromOpenAiUsage({ usage, output: [search, search] })).toEqual({
      inputTokens: 1000, outputTokens: 500, cacheReadTokens: 4000, cacheWriteTokens: 7000, webSearches: 2,
    })
    const tool_usage = { web_search: { num_requests: 3 } } as OpenAI.Responses.Response['tool_usage']
    expect(fromOpenAiUsage({ usage, output: [search], tool_usage }).webSearches).toBe(3)
  })
  it('copes with no usage', () => {
    expect(fromOpenAiUsage({ output: [] })).toEqual({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, webSearches: 0 })
  })
})

describe('webSearchLabel', () => {
  it('names the query when there is one', () => {
    expect(webSearchLabel({ id: 's', type: 'web_search_call', status: 'completed', action: { type: 'search', query: 'gellan' } }))
      .toBe('Searched the web for “gellan”')
    expect(webSearchLabel({ id: 's', type: 'web_search_call', status: 'completed', action: { type: 'open_page', url: 'https://x.test' } }))
      .toBe('Searched the web')
  })
})

describe('isChatModelId', () => {
  it('keeps current chat models and drops media, legacy and specialty ones', () => {
    for (const id of ['gpt-6.1-sol', 'gpt-6-astra', 'gpt-5', 'gpt-5.5-2026-01-01', 'o3', 'o4-mini']) expect(isChatModelId(id), id).toBe(true)
    for (const id of ['gpt-4o', 'gpt-4.1', 'gpt-3.5-turbo', 'gpt-image-2.6', 'gpt-realtime-2.1', 'gpt-transcribe', 'text-embedding-3-small', 'gpt-6-cyber', 'o1', 'dall-e-3', 'gpt-live-1'])
      expect(isChatModelId(id), id).toBe(false)
  })
})
