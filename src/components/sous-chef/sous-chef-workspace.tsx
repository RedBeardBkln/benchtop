'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { BookOpen, ChefHat, MessageSquare, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'
import { readErrorMessage } from '@/lib/utils'
import type { ConversationLink } from '@/lib/sous-chef'
import { ChatComposer, ChatThread, LinkPicker, starterPrompts } from './chat-thread'
import { LabNotebook } from './lab-notebook'
import { LIST_KEY, useConversations, useSousChef, type ConversationSummary } from './sous-chef-session'

// The Sous Chef page: your conversations down the left, the chat in the middle and the team's lab
// notebook on the right (a drawer on smaller screens). The chat is the shared session (sous-chef-session.tsx),
// so following a link in a reply carries it on in the side panel of the page you land on.

const STARTERS = [
  'How can I cut sugar by 30% in a baked good without losing browning or tenderness?',
  'What clean-label alternatives to xanthan gum would stabilize a high-protein beverage?',
  'Explain how water activity and pH work together to keep a shelf-stable filling safe.',
  'What is reverse spherification and when would I use it instead of basic spherification?',
]

export function SousChefWorkspace({ initialConversationId, initialLink }: {
  initialConversationId: string | null
  /** Starts a new conversation about this */
  initialLink: ConversationLink | null
}) {
  const qc = useQueryClient()
  const session = useSousChef()
  const { conversationId, sending, open, closeDock } = session
  const [notebookOpen, setNotebookOpen] = useState(false)
  const [listOpen, setListOpen] = useState(false)

  const { data: conversations = [] } = useConversations()

  // The address picks the conversation; with none, whatever you were in carries on
  useEffect(() => {
    closeDock()
    if (initialConversationId) open(initialConversationId)
    else if (initialLink) open(null, initialLink)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keeps the address on the open conversation. Not router.replace, which would re-render the page on the server.
  useEffect(() => {
    window.history.replaceState(null, '', conversationId ? `/sous-chef?c=${conversationId}` : '/sous-chef')
  }, [conversationId])

  const selectConversation = (id: string | null) => {
    setListOpen(false)
    if (sending || (id && id === conversationId)) return
    open(id)
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
  const link = conversationId ? current?.link ?? null : session.draftLink

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
            <LinkPicker link={link} options={[]} />
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
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
            <ChatThread
              empty={
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
                    {starterPrompts(link, STARTERS).map(p => (
                      <button key={p} onClick={() => session.send(p)} className="text-left text-sm p-3 rounded-md border border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 text-gray-700">
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              }
            />
          </div>
        </div>

        <ChatComposer />
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
