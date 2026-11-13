// What an AI call costs the platform, at Anthropic's list prices (USD per million tokens).
// Cache writes are the 5-minute kind (1.25x input). Web search is $10 per 1,000 searches.
// Pure, so it is unit-testable; update the table when prices or models change.

type Price = { input: number; output: number; cacheRead: number; cacheWrite: number }

const PRICES: Record<string, Price> = {
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  'claude-opus-5': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
}
// Unknown models are priced as the most expensive known one, so the allowance errs on the safe side
const FALLBACK_PRICE: Price = PRICES['claude-opus-5']
const WEB_SEARCH_USD = 10 / 1000

export type TokenUsage = {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  webSearches: number
}

/** Cost in millionths of a dollar (stored as an integer) */
export function usageCostMicros(model: string, u: TokenUsage): number {
  const p = PRICES[model] ?? FALLBACK_PRICE
  // Price per million tokens x tokens = micro-dollars
  const micros = p.input * u.inputTokens + p.output * u.outputTokens
    + p.cacheRead * u.cacheReadTokens + p.cacheWrite * u.cacheWriteTokens
    + WEB_SEARCH_USD * 1_000_000 * u.webSearches
  return Math.round(micros)
}

type AnthropicUsageLike = {
  input_tokens?: number | null
  output_tokens?: number | null
  cache_read_input_tokens?: number | null
  cache_creation_input_tokens?: number | null
  server_tool_use?: { web_search_requests?: number | null } | null
}

export function fromAnthropicUsage(u: AnthropicUsageLike | null | undefined): TokenUsage {
  return {
    inputTokens: u?.input_tokens ?? 0,
    outputTokens: u?.output_tokens ?? 0,
    cacheReadTokens: u?.cache_read_input_tokens ?? 0,
    cacheWriteTokens: u?.cache_creation_input_tokens ?? 0,
    webSearches: u?.server_tool_use?.web_search_requests ?? 0,
  }
}
