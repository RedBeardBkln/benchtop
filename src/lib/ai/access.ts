import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { and, eq, gte, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { aiKeys, aiUsage } from '@/lib/db/schema'
import { ENTITLED_STATUSES } from '@/lib/billing/entitlement'
import { allowanceState, monthlyAllowanceUsd, monthStart, type AllowanceState } from './allowance'
import { decryptApiKey } from './key-crypto'
import { OPENAI_DEFAULT_MODEL } from './openai'
import { fromAnthropicUsage, usageCostMicros, type TokenUsage } from './pricing'

// Every AI call goes through getAi(): it picks the key (the team's own, else the platform's) and,
// on the platform's key, refuses once the team has used its monthly allowance. Each call's usage
// is then recorded with `record`, which is what the allowance is measured from.

export type AiFeature =
  | 'sous_chef'
  | 'ingredient_photos'
  | 'ingredient_url'
  | 'intake_classify'
  | 'intake_label'
  | 'label_parse'
  | 'formulation_research'
  | 'doc_nutrients'
  | 'formulation_import'

export type AiProvider = 'anthropic' | 'openai'

/** The parts of AuthContext getAi needs */
export type AiCaller = {
  account: { id: string; billingExempt: boolean }
  user: { id: string }
  subscription: { status: string; aiAddonQuantity: number } | null
}

export type AnthropicAi = {
  provider: 'anthropic'
  client: Anthropic
  ownKey: boolean
  /** Record one Claude response's usage (pass message.model and message.usage) */
  record: (model: string, usage: Parameters<typeof fromAnthropicUsage>[0]) => Promise<void>
}

export type OpenAiAi = {
  provider: 'openai'
  apiKey: string
  model: string
  ownKey: true
  record: (model: string, usage: TokenUsage) => Promise<void>
}

export type AiGrant = { ok: true; ai: AnthropicAi | OpenAiAi } | { ok: false; res: NextResponse }

export const AI_LIMIT_CODE = 'ai_limit_reached'

/** Add-on units that count: only while the subscription grants access */
export function addonUnits(sub: AiCaller['subscription']): number {
  return sub && ENTITLED_STATUSES.includes(sub.status) ? sub.aiAddonQuantity : 0
}

/** Platform AI the team has used this month, against its allowance */
export async function teamAllowance(caller: AiCaller, now = new Date()): Promise<AllowanceState> {
  const [row] = await db
    .select({ micros: sql<string>`coalesce(sum(${aiUsage.costMicros}), 0)` })
    .from(aiUsage)
    .where(and(eq(aiUsage.accountId, caller.account.id), eq(aiUsage.ownKey, false), gte(aiUsage.createdAt, monthStart(now))))
  const allowance = monthlyAllowanceUsd({ billingExempt: caller.account.billingExempt, addonUnits: addonUnits(caller.subscription) })
  return allowanceState(Number(row?.micros ?? 0), allowance, now)
}

export async function loadAiKey(accountId: string) {
  const [row] = await db.select().from(aiKeys).where(eq(aiKeys.accountId, accountId)).limit(1)
  return row ?? null
}

function recorder(caller: AiCaller, feature: AiFeature, provider: AiProvider, ownKey: boolean) {
  return async (model: string, u: TokenUsage) => {
    try {
      await db.insert(aiUsage).values({
        accountId: caller.account.id,
        userId: caller.user.id,
        feature,
        provider,
        model,
        ownKey,
        ...u,
        costMicros: ownKey ? 0 : usageCostMicros(model, u),
      })
    } catch (e) {
      // Never fail the user's request over metering
      console.error('[ai] could not record usage', feature, e)
    }
  }
}

function limitResponse(state: AllowanceState) {
  const resets = new Date(state.resetsAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })
  return NextResponse.json({
    error: `Your team has used this month’s included AI. It resets on ${resets}. To keep going now, an owner or admin can add your team’s own Claude or OpenAI key, or the owner can add more AI, in Settings › AI.`,
    code: AI_LIMIT_CODE,
  }, { status: 402 })
}

/**
 * The AI to use for one feature. `openai: true` lets the feature run on a team's OpenAI key
 * (only Sous Chef supports it); other features fall back to the platform's Claude key when a team
 * has an OpenAI key, and count toward the allowance.
 */
export async function getAi(caller: AiCaller, feature: AiFeature, opts: { openai?: boolean } = {}): Promise<AiGrant> {
  const key = await loadAiKey(caller.account.id)
  if (key && (key.provider === 'anthropic' || (key.provider === 'openai' && opts.openai))) {
    let apiKey: string
    try {
      apiKey = decryptApiKey(key.keyCiphertext)
    } catch (e) {
      console.error('[ai] could not decrypt the team key', e)
      return { ok: false, res: NextResponse.json({ error: 'Your team’s AI key couldn’t be read. An owner or admin can add it again in Settings › AI.' }, { status: 500 }) }
    }
    if (key.provider === 'anthropic') {
      const record = recorder(caller, feature, 'anthropic', true)
      return { ok: true, ai: { provider: 'anthropic', client: new Anthropic({ apiKey }), ownKey: true, record: (m, u) => record(m, fromAnthropicUsage(u)) } }
    }
    return { ok: true, ai: { provider: 'openai', apiKey, model: key.model ?? OPENAI_DEFAULT_MODEL, ownKey: true, record: recorder(caller, feature, 'openai', true) } }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, res: NextResponse.json({ error: 'AI isn’t configured. An owner or admin can add your team’s own key in Settings › AI.' }, { status: 503 }) }
  }
  const state = await teamAllowance(caller)
  if (state.exhausted) return { ok: false, res: limitResponse(state) }
  const record = recorder(caller, feature, 'anthropic', false)
  return {
    ok: true,
    ai: { provider: 'anthropic', client: new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }), ownKey: false, record: (m, u) => record(m, fromAnthropicUsage(u)) },
  }
}

/** For features that only run on Claude */
export async function getClaude(caller: AiCaller, feature: AiFeature): Promise<{ ok: true; ai: AnthropicAi } | { ok: false; res: NextResponse }> {
  const grant = await getAi(caller, feature)
  if (!grant.ok) return grant
  if (grant.ai.provider !== 'anthropic') throw new Error('unreachable: OpenAI was not requested')
  return { ok: true, ai: grant.ai }
}
