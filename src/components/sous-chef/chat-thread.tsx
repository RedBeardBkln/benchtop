'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowUp, Check, ChefHat, ChevronDown, Link2, Loader2 } from 'lucide-react'
import { readErrorMessage } from '@/lib/utils'
import { MESSAGE_MAX_CHARS, type ConversationLink, type LinkScope } from '@/lib/sous-chef'
import { ChatMarkdown } from './chat-markdown'
import { LIST_KEY, useSousChef } from './sous-chef-session'

// The pieces of a Sous Chef chat shared by the Sous Chef page and the side panel

/** The session's messages, newest at the bottom */
export function ChatThread({ empty }: { empty: React.ReactNode }) {
  const { messages, loading, followLink } = useSousChef()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  return (
    <div className="space-y-6">
      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {!loading && messages.length === 0 && empty}
      {messages.map(m => m.role === 'user' ? (
        <div key={m.id} className="flex justify-end">
          <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-sm bg-blue-600 text-white text-sm whitespace-pre-wrap break-words">
            {m.content}
          </div>
        </div>
      ) : (
        <div key={m.id} className="flex gap-3">
          <div className="shrink-0 w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
            <ChefHat size={15} />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            {m.activity.length > 0 && (
              <ul className="space-y-0.5">
                {m.activity.map((a, i) => <li key={i} className="text-xs text-gray-500">• {a}</li>)}
              </ul>
            )}
            {m.content && <ChatMarkdown text={m.content} onInternalLink={followLink} />}
            {m.pending && (
              <p className="inline-flex items-center gap-2 text-xs text-gray-500">
                <Loader2 size={13} className="animate-spin" /> {m.content ? 'Writing…' : 'Thinking…'}
              </p>
            )}
            {m.error && <p className="text-sm text-red-600">{m.error}</p>}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}

/** Starter prompts for an empty conversation, tuned to what it's about */
export function starterPrompts(link: ConversationLink | null, general: string[]): string[] {
  if (!link) return general
  const about = { iteration: 'this iteration', formulation: 'this formulation', project: 'this project' }[link.scope]
  return [
    `Review ${about} and suggest the three changes that would most improve it.`,
    ...(link.scope === 'project'
      ? ['Compare the formulations in this project. Which is closest to the targets, and why?']
      : link.scope === 'formulation'
        ? ['What changed between the iterations, and how did each change move the results?']
        : ['How does this iteration differ from the others, and is it better?']),
    ...general.slice(0, 2),
  ]
}

export function ChatComposer({ compact = false }: { compact?: boolean }) {
  const { input, setInput, send, sending } = useSousChef()
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!sending) inputRef.current?.focus()
  }, [sending])

  return (
    <form
      className={`border-t border-gray-200 ${compact ? 'px-3 py-2.5' : 'px-4 sm:px-6 py-3'}`}
      onSubmit={e => { e.preventDefault(); send(input) }}
    >
      <div className={`flex items-end gap-2 ${compact ? '' : 'max-w-3xl mx-auto'}`}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(input) } }}
          rows={Math.min(6, Math.max(1, input.split('\n').length))}
          maxLength={MESSAGE_MAX_CHARS}
          placeholder="Ask Sous Chef…"
          aria-label="Message Sous Chef"
          className="flex-1 resize-none px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit" disabled={sending || !input.trim()}
          className="p-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40" aria-label="Send"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={16} />}
        </button>
      </div>
      <p className={`mt-1.5 text-[11px] text-gray-400 ${compact ? '' : 'max-w-3xl mx-auto'}`}>
        Sous Chef can make mistakes. Check safety-critical and regulatory advice, and confirm changes at the bench.
      </p>
    </form>
  )
}

export const SCOPE_LABEL: Record<LinkScope, string> = {
  iteration: 'Iteration',
  formulation: 'Formulation',
  project: 'Project',
}

/**
 * What the current conversation is about, with a menu to link it to something on this page or unlink it.
 * A new conversation keeps the choice until its first message; a saved one is updated right away.
 */
export function LinkPicker({ link, options }: {
  link: ConversationLink | null
  options: { label: string; link: ConversationLink }[]
}) {
  const qc = useQueryClient()
  const { conversationId, setDraftLink, followLink, sending } = useSousChef()
  const [menuOpen, setMenuOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  async function choose(next: ConversationLink | null) {
    setMenuOpen(false)
    if (next?.scope === link?.scope && next?.id === link?.id) return
    if (!conversationId) return setDraftLink(next)
    setSaving(true)
    const r = await fetch(`/api/sous-chef/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ link: next && { scope: next.scope, id: next.id } }),
    })
    setSaving(false)
    if (!r.ok) return toast.error(await readErrorMessage(r, 'Could not link the conversation'))
    qc.invalidateQueries({ queryKey: LIST_KEY })
  }

  if (!link && options.length === 0) return null
  const same = (a: ConversationLink | null, b: ConversationLink | null) => a?.scope === b?.scope && a?.id === b?.id
  // The current link stays on the menu even when it isn't from this page
  const choices = link && !options.some(o => same(o.link, link)) ? [{ label: SCOPE_LABEL[link.scope], link }, ...options] : options

  return (
    <div className="relative flex items-center gap-1 min-w-0 text-xs text-gray-500">
      <Link2 size={12} className="shrink-0" />
      {link ? (
        <span className="min-w-0 truncate">
          {SCOPE_LABEL[link.scope]}:{' '}
          <a href={link.href} onClick={e => followLink(e, link.href)} className="text-blue-600 hover:underline">{link.name}</a>
          {link.scope === 'formulation' && ' (all iterations)'}
        </span>
      ) : (
        <span>Not linked</span>
      )}
      <button
        onClick={() => setMenuOpen(o => !o)} disabled={saving || sending}
        className="shrink-0 inline-flex items-center gap-0.5 px-1 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-100 disabled:opacity-50"
        aria-haspopup="menu" aria-expanded={menuOpen}
      >
        {saving ? <Loader2 size={12} className="animate-spin" /> : <>Change <ChevronDown size={12} /></>}
      </button>
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
          <div role="menu" className="absolute left-0 top-full mt-1 z-20 w-72 max-w-[calc(100vw-2rem)] py-1 rounded-md border border-gray-200 bg-white shadow-lg">
            <p className="px-3 py-1 text-[11px] font-medium text-gray-400 uppercase tracking-wide">Link this conversation to</p>
            {[...choices, { label: 'Nothing', link: null }].map(o => (
              <button
                key={o.link ? `${o.link.scope}:${o.link.id}` : 'none'} role="menuitem"
                onClick={() => choose(o.link)}
                className="w-full flex items-start gap-2 px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                <span className="w-3.5 shrink-0 pt-0.5">{same(o.link, link) && <Check size={14} className="text-blue-600" />}</span>
                <span className="min-w-0">
                  {o.label}
                  {o.link && <span className="block text-xs text-gray-500 truncate">{o.link.name}{o.link.scope === 'formulation' && ', all iterations'}</span>}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
