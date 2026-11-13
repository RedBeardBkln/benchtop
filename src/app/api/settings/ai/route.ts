import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { aiKeys } from '@/lib/db/schema'
import { isTeamAdmin } from '@/lib/team-access'
import { ENTITLED_STATUSES } from '@/lib/billing/entitlement'
import { isAiAddonConfigured } from '@/lib/billing/stripe'
import { AI_ADDON, AI_INCLUDED_USD } from '@/lib/ai/allowance'
import { addonUnits, loadAiKey, teamAllowance } from '@/lib/ai/access'
import { encryptApiKey, isKeyEncryptionConfigured, keyHint } from '@/lib/ai/key-crypto'
import { listOpenAiModels } from '@/lib/ai/openai'

// Settings › AI: the team's AI use this month, its own key (owners and admins), and the add-on.

export async function GET() {
  const auth = await requireApi({ allowUnentitled: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const [usage, key] = await Promise.all([teamAllowance(ctx), loadAiKey(ctx.account.id)])
  const sub = ctx.subscription
  return NextResponse.json({
    usage,
    includedUsd: AI_INCLUDED_USD,
    ownKey: key ? { provider: key.provider, hint: key.keyHint, model: key.model, updatedAt: key.updatedAt } : null,
    canManageKey: isTeamAdmin(ctx.role),
    keyStorageReady: isKeyEncryptionConfigured(),
    addon: {
      configured: isAiAddonConfigured(),
      canBuy: ctx.role === 'owner',
      subscribed: Boolean(sub?.stripeSubscriptionId && ENTITLED_STATUSES.includes(sub.status)),
      units: addonUnits(sub),
      ...AI_ADDON,
    },
    billingExempt: ctx.account.billingExempt,
  })
}

const keySchema = z.discriminatedUnion('provider', [
  z.object({ provider: z.literal('anthropic'), apiKey: z.string().trim().min(20).max(400) }),
  z.object({ provider: z.literal('openai'), apiKey: z.string().trim().min(20).max(400), model: z.string().trim().min(1).max(100) }),
])

// Owners and admins: save the team's key, after checking it works
export async function PUT(req: NextRequest) {
  const auth = await requireApi({ allowUnentitled: true, teamAdmin: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  if (!isKeyEncryptionConfigured()) {
    return NextResponse.json({ error: 'Saving your own key isn’t available yet (AI_KEY_SECRET is not set)' }, { status: 503 })
  }
  const parsed = keySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid API key' }, { status: 400 })
  const input = parsed.data

  if (input.provider === 'anthropic') {
    try {
      await new Anthropic({ apiKey: input.apiKey, maxRetries: 0 }).models.list({ limit: 1 })
    } catch (e) {
      return NextResponse.json({ error: keyErrorMessage(e, 'Claude') }, { status: 400 })
    }
  } else {
    let models: string[]
    try {
      models = await listOpenAiModels(input.apiKey)
    } catch (e) {
      return NextResponse.json({ error: keyErrorMessage(e, 'OpenAI') }, { status: 400 })
    }
    if (!models.includes(input.model)) {
      return NextResponse.json({ error: `This key can’t use ${input.model}. Choose another model.`, models }, { status: 400 })
    }
  }

  const values = {
    provider: input.provider,
    keyCiphertext: encryptApiKey(input.apiKey),
    keyHint: keyHint(input.apiKey),
    model: input.provider === 'openai' ? input.model : null,
    setBy: ctx.user.id,
    updatedAt: new Date(),
  }
  await db.insert(aiKeys).values({ accountId: ctx.account.id, ...values })
    .onConflictDoUpdate({ target: aiKeys.accountId, set: values })
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const auth = await requireApi({ allowUnentitled: true, teamAdmin: true })
  if (!auth.ok) return auth.res
  await db.delete(aiKeys).where(eq(aiKeys.accountId, auth.ctx.account.id))
  return NextResponse.json({ ok: true })
}

function keyErrorMessage(e: unknown, provider: string): string {
  const status = (e as { status?: number })?.status
  if (status === 401 || status === 403) return `${provider} didn’t accept that key. Check it and try again.`
  return `Couldn’t check the key with ${provider} right now. Try again in a minute.`
}
