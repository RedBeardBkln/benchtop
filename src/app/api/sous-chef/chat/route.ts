import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { and, desc, eq } from 'drizzle-orm'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { sousChefConversations, sousChefMessages } from '@/lib/db/schema'
import { AI_MODEL } from '@/lib/ai-json'
import { getAi } from '@/lib/ai/access'
import {
  buildContextPrompt, chatInputSchema, HISTORY_TURNS, MAX_ROUNDS, SOUS_CHEF_PERSONA, titleFromMessage, type SousChefEvent,
} from '@/lib/sous-chef'
import {
  describeLinkForPrompt, loadPromptNotes, resolveConversationLink, runSousChefTool, SOUS_CHEF_TOOLS, type SousChefScope,
} from '@/lib/sous-chef-server'
import { openAiErrorMessage, runOpenAiConversation } from '@/lib/sous-chef-openai'

export const maxDuration = 300

// POST: send a message, get Sous Chef's reply as newline-delimited JSON events (SousChefEvent)
export async function POST(req: NextRequest) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth
  const scope: SousChefScope = { account: ctx.account, access: ctx.access, user: ctx.user }

  const parsed = chatInputSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const input = parsed.data

  // Before anything is saved, so a refused request (out of included AI, no key) leaves nothing behind
  const grant = await getAi(ctx, 'sous_chef', { openai: true })
  if (!grant.ok) return grant.res
  const ai = grant.ai

  let conversation: typeof sousChefConversations.$inferSelect
  let isNew = false
  if (input.conversationId) {
    const [row] = await db.select().from(sousChefConversations)
      .where(and(
        eq(sousChefConversations.id, input.conversationId),
        eq(sousChefConversations.accountId, ctx.account.id),
        eq(sousChefConversations.userId, ctx.user.id),
      )).limit(1)
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    conversation = row
  } else {
    // A link to something the caller can't see is dropped rather than refused
    const ids = await resolveConversationLink(scope, input.link) ?? await resolveConversationLink(scope, null)
    ;[conversation] = await db.insert(sousChefConversations).values({
      accountId: ctx.account.id, userId: ctx.user.id, title: titleFromMessage(input.message), ...ids,
    }).returning()
    isNew = true
  }

  await db.insert(sousChefMessages).values({ conversationId: conversation.id, role: 'user', content: input.message })

  const [history, notes, focus] = await Promise.all([
    db.select({ role: sousChefMessages.role, content: sousChefMessages.content })
      .from(sousChefMessages)
      .where(eq(sousChefMessages.conversationId, conversation.id))
      .orderBy(desc(sousChefMessages.createdAt))
      .limit(HISTORY_TURNS),
    loadPromptNotes(scope),
    describeLinkForPrompt(scope, conversation),
  ])
  const turns = history.reverse()
  while (turns.length > 0 && turns[0].role !== 'user') turns.shift()
  const chatTurns = turns.map(t => ({ role: t.role as 'user' | 'assistant', content: t.content }))
  const messages: Anthropic.Beta.BetaMessageParam[] = chatTurns.map(t => ({ ...t }))

  const contextPrompt = buildContextPrompt({ accountName: ctx.account.name, today: new Date().toISOString().slice(0, 10), notes, focus })
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: 'text', text: SOUS_CHEF_PERSONA },
    { type: 'text', text: contextPrompt, cache_control: { type: 'ephemeral' } },
  ]

  const encoder = new TextEncoder()

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: SousChefEvent) => {
        // Ignored once the browser has gone; the reply is still saved
        try { controller.enqueue(encoder.encode(JSON.stringify(e) + '\n')) } catch {}
      }
      const parts: string[] = []
      const activity: string[] = []
      const logActivity = (label: string) => {
        // Web search runs from code the model writes, which can repeat the same query; list it once
        if (activity.includes(label)) return
        activity.push(label)
        send({ type: 'activity', label })
      }
      const runTool = (block: { id: string; name: string; input: unknown }) => runSousChefTool(block, {
        scope,
        conversationId: conversation.id,
        onNote: note => send({ type: 'note', ...note }),
      })

      if (isNew) send({ type: 'conversation', id: conversation.id, title: conversation.title })

      try {
        if (ai.provider === 'openai') {
          // A team's own OpenAI key: the same conversation on the Responses API
          await runOpenAiConversation({
            ai, instructions: `${SOUS_CHEF_PERSONA}\n\n${contextPrompt}`, history: chatTurns,
            tools: SOUS_CHEF_TOOLS, runTool, send, logActivity, parts,
          })
        } else for (let round = 0; round < MAX_ROUNDS; round++) {
          // Keep separate rounds' text apart in the chat
          let first = true
          const stream = ai.client.beta.messages.stream({
            model: AI_MODEL,
            max_tokens: 64000,
            betas: ['server-side-fallback-2026-06-01'],
            fallbacks: [{ model: 'claude-opus-5' }],
            output_config: { effort: 'medium' },
            system,
            tools: SOUS_CHEF_TOOLS,
            messages,
          })
          stream.on('text', delta => {
            if (first && parts.length > 0) send({ type: 'text', text: '\n\n' })
            first = false
            send({ type: 'text', text: delta })
          })
          stream.on('contentBlock', block => {
            if (block.type === 'server_tool_use' && block.name === 'web_search') {
              const q = (block.input as { query?: unknown })?.query
              logActivity(typeof q === 'string' ? `Searched the web for “${q}”` : 'Searched the web')
            }
          })
          const message = await stream.finalMessage()
          await ai.record(message.model, message.usage)

          const text = message.content.flatMap(b => (b.type === 'text' ? [b.text] : [])).join('')
          if (text) parts.push(text)

          if (message.stop_reason === 'refusal') {
            const msg = 'Sous Chef can’t help with that request.'
            parts.push(msg)
            send({ type: 'text', text: `${text ? '\n\n' : ''}${msg}` })
            break
          }
          if (message.stop_reason === 'pause_turn') {
            messages.push({ role: 'assistant', content: message.content })
            continue
          }
          const toolUses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use')
          if (message.stop_reason !== 'tool_use' || toolUses.length === 0) {
            if (message.stop_reason === 'max_tokens') send({ type: 'text', text: '\n\n_(The reply was cut off.)_' })
            break
          }

          messages.push({ role: 'assistant', content: message.content })
          // One at a time: a dozen formulation reads at once put more queries in flight than the database
          // client has connections, and through the pooler some then stall until the statement timeout
          const results: Awaited<ReturnType<typeof runSousChefTool>>[] = []
          for (const b of toolUses) results.push(await runTool(b))
          for (const r of results) if (r.label) logActivity(r.label)
          messages.push({ role: 'user', content: results.map(r => r.result) })
        }
      } catch (err) {
        console.error('[sous-chef]', err)
        const error = err instanceof Anthropic.RateLimitError
          ? 'Sous Chef is busy right now. Try again in a minute.'
          : openAiErrorMessage(err) ?? 'Sous Chef ran into a problem. Try again.'
        send({ type: 'error', error })
      }

      const content = parts.join('\n\n').trim()
      if (content) {
        const [saved] = await db.insert(sousChefMessages)
          .values({ conversationId: conversation.id, role: 'assistant', content, activity })
          .returning({ id: sousChefMessages.id })
        await db.update(sousChefConversations).set({ updatedAt: new Date() })
          .where(eq(sousChefConversations.id, conversation.id))
        send({ type: 'done', messageId: saved.id })
      }
      // Throws if the browser already went away
      try { controller.close() } catch {}
    },
  })

  return new Response(body, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
