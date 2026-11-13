import { pgTable, uuid, text, timestamp, integer, bigint, boolean, index } from 'drizzle-orm/pg-core'
import { accounts } from './accounts'

// A team's own AI key (Claude or OpenAI), added by an owner or admin in Settings › AI. When set,
// the team's AI runs on it instead of the platform's key and its included monthly allowance.
// The key is encrypted with AI_KEY_SECRET (lib/ai/key-crypto.ts) and never sent back to the browser.
export const aiKeys = pgTable('ai_keys', {
  accountId: uuid('account_id').primaryKey().references(() => accounts.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(), // 'anthropic' | 'openai'
  keyCiphertext: text('key_ciphertext').notNull(),
  // Last four characters, to show which key is saved
  keyHint: text('key_hint').notNull(),
  // OpenAI model Sous Chef uses with an OpenAI key; null for Claude keys
  model: text('model'),
  setBy: uuid('set_by').notNull(), // Supabase auth UID
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// One row per AI call (a Sous Chef reply is one row per model round). Calls on the platform's key
// count toward the team's monthly allowance; calls on the team's own key are recorded with
// own_key = true and cost nothing to the platform.
export const aiUsage = pgTable('ai_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  feature: text('feature').notNull(), // see AiFeature in lib/ai/access.ts
  provider: text('provider').notNull(), // 'anthropic' | 'openai'
  model: text('model').notNull(),
  ownKey: boolean('own_key').notNull(),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  cacheReadTokens: integer('cache_read_tokens').notNull().default(0),
  cacheWriteTokens: integer('cache_write_tokens').notNull().default(0),
  webSearches: integer('web_searches').notNull().default(0),
  // Platform cost in millionths of a dollar, at list prices (lib/ai/pricing.ts); 0 on the team's own key
  costMicros: bigint('cost_micros', { mode: 'number' }).notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('ai_usage_account_created_idx').on(t.accountId, t.createdAt),
])
