'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowUp, BookOpen, ChefHat, Loader2, MessageSquare, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { readErrorMessage } from '@/lib/utils'
import { MESSAGE_MAX_CHARS, SOUS_CHEF_NOTE_KINDS, type SousChefEvent } from '@/lib/sous-chef'
import { ChatMarkdown } from './chat-markdown'
import { LabNotebook, NOTES_KEY } from './lab-notebook'

// The Sous Chef page: your conversations down the left, the chat in the middle and the team's lab
// notebook on the right (a drawer on smaller screens).

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  activity: string[]
  /** Still streaming in */
  pending?: boolean
  error?: string
}

type ConversationSummary = { id: string; title: string; updatedAt: string }

export type SousChefFocus = { kind: 'project' | 'formulation'; id: string; name: string; projectId: string | null }

const LIST_KEY = ['sous-chef-conversations']

const STARTERS = [
  'How can I cut sugar by 30% in a baked good without losing browning or tenderness?',
  'What clean-label alternatives to xanthan gum would stabilize a high-protein beverage?',
  'Explain how water activity and pH work together to keep a shelf-stable filling safe.',
  'What is reverse spherification and when would I use it instead of basic spherification?',
]

export function SousChefWorkspace({ initialConversationId, focus }: {
  initialConversationId: string | null
  focus: SousChefFocus | null
}) {
  const qc = useQueryClient()
  const pathname = usePathname()
  // Updates the address without a navigation. router.replace would re-render the page on the server
  // and, coming from a formulation (?formulation=…), remount this chat mid-reply and lose the reply.
  const setUrl = (conversation: string | null) =>
    window.history.replaceState(null, '', conversation ? `${pathname}?c=${conversation}` : pathname)
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loadingConversation, setLoadingConversation] = useState(!!initialConversationId)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [notebookOpen, setNotebookOpen] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  // What a new conversation is about; cleared once you start over without it
  const [activeFocus, setActiveFocus] = useState<SousChefFocus | null>(focus)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const { data: conversations = [] } = useQuery<ConversationSummary[]>({
    queryKey: LIST_KEY,
    queryFn: async () => {
      const r = await fetch('/api/sous-chef/conversations')
      if (!r.ok) throw new Error('Could not load conversations')
      return r.json()
    },
  })

  // Load the selected conversation (not while one is being created by sending)
  useEffect(() => {
    if (!conversationId || sending) return
    let canceled = false
    setLoadingConversation(true)
    fetch(`/api/sous-chef/conversations/${conversationId}`)
      .then(async r => {
        if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not open that conversation'))
        return r.json() as Promise<{ messages: ChatMessage[] }>
      })
      .then(d => { if (!canceled) setMessages(d.messages) })
      .catch((e: Error) => { if (!canceled) { toast.error(e.message); setConversationId(null) } })
      .finally(() => { if (!canceled) setLoadingConversation(false) })
    return () => { canceled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  const selectConversation = (id: string | null) => {
    setListOpen(false)
    if (sending || id === conversationId) return
    setMessages([])
    setConversationId(id)
    if (!id) setActiveFocus(null)
    setUrl(id)
    if (!id) inputRef.current?.focus()
  }

  const patchLast = (fn: (m: ChatMessage) => ChatMessage) =>
    setMessages(ms => ms.length ? [...ms.slice(0, -1), fn(ms[ms.length - 1])] : ms)

  async function send(text: string) {
    const message = text.trim()
    if (!message || sending) return
    setSending(true)
    setInput('')
    setMessages(ms => [
      ...ms,
      { id: `u-${Date.now()}`, role: 'user', content: message, activity: [] },
      { id: `a-${Date.now()}`, role: 'assistant', content: '', activity: [], pending: true },
    ])

    try {
      const r = await fetch('/api/sous-chef/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          message,
          projectId: !conversationId && activeFocus ? activeFocus.projectId : null,
          formulationId: !conversationId && activeFocus?.kind === 'formulation' ? activeFocus.id : null,
        }),
      })
      if (!r.ok || !r.body) throw new Error(await readErrorMessage(r, 'Sous Chef could not answer'))

      const reader = r.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      const handle = (e: SousChefEvent) => {
        switch (e.type) {
          case 'conversation':
            setConversationId(e.id)
            setUrl(e.id)
            qc.invalidateQueries({ queryKey: LIST_KEY })
            break
          case 'text':
            patchLast(m => ({ ...m, content: m.content + e.text }))
            break
          case 'activity':
            patchLast(m => ({ ...m, activity: [...m.activity, e.label] }))
            break
          case 'note':
            toast.success(`Recorded in the lab notebook: ${SOUS_CHEF_NOTE_KINDS[e.kind].label.toLowerCase()}`, { description: e.content })
            qc.invalidateQueries({ queryKey: NOTES_KEY })
            break
          case 'done':
            patchLast(m => ({ ...m, id: e.messageId, pending: false }))
            break
          case 'error':
            patchLast(m => ({ ...m, error: e.error }))
            break
        }
      }
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) if (line.trim()) handle(JSON.parse(line) as SousChefEvent)
      }
      // Never leave an empty reply looking like silence
      patchLast(m => ({
        ...m, pending: false,
        error: m.content || m.error ? m.error : 'No reply came back. Try sending your message again.',
      }))
      qc.invalidateQueries({ queryKey: LIST_KEY })
    } catch (e) {
      patchLast(m => ({ ...m, pending: false, error: (e as Error).message }))
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  async function rename(c: ConversationSummary) {
    const title = window.prompt('Name this conversation', c.title)?.trim()
    if (!title || title === c.title) return
    const r = await fetch(`/api/sous-chef/conversations/${c.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }),
    })
    if (!r.ok) return toast.error(await readErrorMessage(r, 'Could not rename it'))
    qc.invalidateQueries({ queryKey: LIST_KEY })
  }

  async function remove(c: ConversationSummary) {
    if (!window.confirm(`Delete “${c.title}”? Notes it recorded stay in the lab notebook.`)) return
    const r = await fetch(`/api/sous-chef/conversations/${c.id}`, { method: 'DELETE' })
    if (!r.ok) return toast.error(await readErrorMessage(r, 'Could not delete it'))
    if (c.id === conversationId) selectConversation(null)
    qc.invalidateQueries({ queryKey: LIST_KEY })
  }

  const current = conversations.find(c => c.id === conversationId)

  const conversationList = (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-200">
        <button
          onClick={() => selectConversation(null)} disabled={sending}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus size={16} /> New conversation
        </button>
      </div>
      <ul className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {conversations.length === 0 && <li className="px-2 py-3 text-xs text-gray-500">Your conversations will show here.</li>}
        {conversations.map(c => (
          <li key={c.id} className="group flex items-center">
            <button
              onClick={() => selectConversation(c.id)}
              className={`flex-1 min-w-0 text-left px-2 py-1.5 rounded-md text-sm truncate ${
                c.id === conversationId ? 'bg-blue-50 text-blue-800 font-medium' : 'text-gray-700 hover:bg-gray-100'
              }`}
              title={c.title}
            >
              {c.title}
            </button>
            <div className="flex sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
              <button onClick={() => rename(c)} className="p-1 rounded text-gray-400 hover:text-gray-700" aria-label={`Rename ${c.title}`}><Pencil size={13} /></button>
              <button onClick={() => remove(c)} className="p-1 rounded text-gray-400 hover:text-red-600" aria-label={`Delete ${c.title}`}><Trash2 size={13} /></button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )

  return (
    <div className="flex h-[calc(100dvh-9rem)] sm:h-[calc(100dvh-3.5rem)] bg-white border-b border-gray-200">
      <aside className="hidden lg:block w-64 shrink-0 border-r border-gray-200 bg-gray-50/60">{conversationList}</aside>

      <section className="flex-1 min-w-0 flex flex-col">
        <header className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b border-gray-200">
          <button onClick={() => setListOpen(true)} className="lg:hidden p-1.5 rounded-md text-gray-600 hover:bg-gray-100" aria-label="Conversations">
            <MessageSquare size={18} />
          </button>
          <ChefHat size={20} className="text-gray-700 shrink-0" />
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-gray-900 truncate">{current?.title ?? 'Sous Chef'}</h1>
            {!conversationId && activeFocus && (
              <p className="text-xs text-gray-500 truncate">
                About {activeFocus.kind === 'formulation' ? 'formulation' : 'project'}{' '}
                <Link href={`/${activeFocus.kind === 'formulation' ? 'formulations' : 'projects'}/${activeFocus.id}`} className="text-blue-600 hover:underline">
                  {activeFocus.name}
                </Link>
                <button onClick={() => setActiveFocus(null)} className="ml-1 align-middle text-gray-400 hover:text-gray-600" aria-label="Don’t attach it">
                  <X size={12} />
                </button>
              </p>
            )}
          </div>
          <button
            onClick={() => setNotebookOpen(o => !o)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-md ${notebookOpen ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}
            aria-pressed={notebookOpen}
          >
            <BookOpen size={16} /> <span className="hidden sm:inline">Lab notebook</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
            {loadingConversation && <p className="text-sm text-gray-500">Loading…</p>}
            {!loadingConversation && messages.length === 0 && (
              <div className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={18} className="text-amber-500" />
                  <h2 className="text-lg font-semibold text-gray-900">Your product-development sidekick</h2>
                </div>
                <p className="text-sm text-gray-600 mb-5">
                  Ask about food science, molecular gastronomy, ingredient swaps or how to hit a target. Sous Chef can read
                  your projects, formulations and ingredient library, search the web, and records decisions in the team’s
                  lab notebook so they carry into future projects.
                </p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {(activeFocus
                    ? [`Review this ${activeFocus.kind} and suggest the three changes that would most improve it.`, ...STARTERS.slice(0, 3)]
                    : STARTERS
                  ).map(s => (
                    <button key={s} onClick={() => send(s)} className="text-left text-sm p-3 rounded-md border border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 text-gray-700">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
                  {m.content && <ChatMarkdown text={m.content} />}
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
        </div>

        <form
          className="border-t border-gray-200 px-4 sm:px-6 py-3"
          onSubmit={e => { e.preventDefault(); send(input) }}
        >
          <div className="max-w-3xl mx-auto flex items-end gap-2">
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
          <p className="max-w-3xl mx-auto mt-1.5 text-[11px] text-gray-400">
            Sous Chef can make mistakes. Check safety-critical and regulatory advice, and confirm changes at the bench.
          </p>
        </form>
      </section>

      {notebookOpen && (
        <>
          <aside className="hidden lg:block w-80 shrink-0 border-l border-gray-200 bg-gray-50/60">
            <LabNotebook onClose={() => setNotebookOpen(false)} />
          </aside>
          <div className="lg:hidden fixed inset-0 z-50 bg-black/30" onClick={() => setNotebookOpen(false)}>
            <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-gray-50 shadow-xl" onClick={e => e.stopPropagation()}>
              <LabNotebook onClose={() => setNotebookOpen(false)} />
            </div>
          </div>
        </>
      )}

      {listOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/30" onClick={() => setListOpen(false)}>
          <div className="absolute left-0 top-0 bottom-0 w-full max-w-xs bg-gray-50 shadow-xl" onClick={e => e.stopPropagation()}>
            {conversationList}
          </div>
        </div>
      )}
    </div>
  )
}
