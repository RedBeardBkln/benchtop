'use client'

import Link from 'next/link'
import { ChefHat, Maximize2, MessageSquare, MessageSquarePlus, X } from 'lucide-react'
import type { ConversationLink } from '@/lib/sous-chef'
import { ChatComposer, ChatThread, LinkPicker, SCOPE_LABEL, starterPrompts } from './chat-thread'
import { isAboutPage, pageLinkOptions, useConversations, useSousChef, type ConversationSummary, type SousChefPage } from './sous-chef-session'

// Sous Chef beside a project or formulation: start a conversation about it, or pick up one that's
// already about it, without leaving the page. It stays open (and keeps the chat) as you follow links.

const STARTERS = [
  'What clean-label alternatives would stabilize this?',
  'Which ingredient here contributes most to cost, and what could replace it?',
]

export function SousChefDock() {
  const s = useSousChef()
  const { data: conversations = [] } = useConversations()
  const current = conversations.find(c => c.id === s.conversationId)
  const link = s.conversationId ? current?.link ?? null : s.draftLink
  const options = pageLinkOptions(s.page)

  return (
    <aside
      aria-label="Sous Chef"
      className="fixed z-40 inset-x-0 top-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] sm:bottom-0 sm:left-auto sm:w-[400px] sm:shadow-xl sm:border-l border-gray-200
        lg:sticky lg:inset-auto lg:top-0 lg:h-dvh lg:shrink-0 lg:shadow-none flex flex-col bg-white print:hidden"
    >
      <header className="flex items-center gap-1 px-3 py-2.5 border-b border-gray-200">
        <ChefHat size={18} className="text-gray-700 shrink-0 mr-1" />
        <h2 className="flex-1 min-w-0 text-sm font-semibold text-gray-900 truncate">
          {s.dockView === 'list' ? 'Sous Chef' : current?.title ?? 'New conversation'}
        </h2>
        <button
          onClick={() => s.showDock(s.dockView === 'list' ? 'chat' : 'list')}
          disabled={s.dockView === 'list' && !s.conversationId && !s.draftLink && s.messages.length === 0}
          className={`p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40 ${s.dockView === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-600'}`}
          aria-label="Conversations" aria-pressed={s.dockView === 'list'} title="Conversations"
        >
          <MessageSquare size={16} />
        </button>
        <Link
          href={s.conversationId ? `/sous-chef?c=${s.conversationId}` : '/sous-chef'}
          onClick={s.closeDock}
          className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100" aria-label="Open the Sous Chef page" title="Open the Sous Chef page"
        >
          <Maximize2 size={16} />
        </Link>
        <button onClick={s.closeDock} className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100" aria-label="Close Sous Chef" title="Close">
          <X size={16} />
        </button>
      </header>

      {s.dockView === 'list' ? (
        <ConversationPicker conversations={conversations} page={s.page} />
      ) : (
        <>
          <div className="px-3 py-1.5 border-b border-gray-100">
            <LinkPicker link={link} options={options} />
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <ChatThread
              empty={
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    {link
                      ? <>Ask anything about {link.scope === 'iteration' ? 'this iteration' : link.scope === 'formulation' ? 'this formulation' : 'this project'}. Sous Chef can read it, and links to other formulations and iterations it mentions.</>
                      : 'Ask about food science, ingredient swaps or how to hit a target.'}
                  </p>
                  {starterPrompts(link, STARTERS).map(p => (
                    <button key={p} onClick={() => s.send(p)} className="w-full text-left text-sm p-2.5 rounded-md border border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 text-gray-700">
                      {p}
                    </button>
                  ))}
                </div>
              }
            />
          </div>
          <ChatComposer compact />
        </>
      )}
    </aside>
  )
}

/** Start a conversation about this page, or pick one that's already about it */
function ConversationPicker({ conversations, page }: { conversations: ConversationSummary[]; page: SousChefPage | null }) {
  const s = useSousChef()
  const options = pageLinkOptions(page)
  const related = conversations.filter(c => isAboutPage(c, page))
  const f = page?.formulation
  const groups: { title: string; items: ConversationSummary[] }[] = f
    ? [
        { title: 'About this formulation', items: related.filter(c => c.formulationFamilyId === f.familyId) },
        { title: 'About the project', items: related.filter(c => !c.formulationFamilyId) },
      ]
    : [{ title: page ? 'About this project' : 'Recent', items: page ? related : conversations.slice(0, 10) }]
  const currentElsewhere = s.conversationId && !related.some(c => c.id === s.conversationId)
    ? conversations.find(c => c.id === s.conversationId)
    : undefined

  const start = (link: ConversationLink | null) => { s.open(null, link); s.showDock('chat') }
  const pick = (id: string) => { s.open(id); s.showDock('chat') }

  // Which of this page's links a conversation has, e.g. "This iteration" or "v2"
  function badge(c: ConversationSummary) {
    if (!c.link) return null
    if (f && c.formulationId === f.id) return 'This iteration'
    if (f && c.link.scope === 'iteration' && c.formulationFamilyId === f.familyId) return c.link.name.slice(c.link.name.lastIndexOf(' v') + 1)
    if (f && c.link.scope === 'formulation') return 'All iterations'
    if (!f && c.link.scope !== 'project') return c.link.name
    return SCOPE_LABEL[c.link.scope]
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-5">
      {currentElsewhere && (
        <button
          onClick={() => s.showDock('chat')}
          className="w-full text-left p-2.5 rounded-md border border-blue-200 bg-blue-50/50 hover:bg-blue-50"
        >
          <span className="block text-[11px] font-medium text-blue-700 uppercase tracking-wide">Back to your conversation</span>
          <span className="block text-sm text-gray-800 truncate">{currentElsewhere.title}</span>
          {currentElsewhere.link && <span className="block text-xs text-gray-500 truncate">{SCOPE_LABEL[currentElsewhere.link.scope]}: {currentElsewhere.link.name}</span>}
        </button>
      )}

      <section>
        <h3 className="mb-1.5 text-[11px] font-medium text-gray-400 uppercase tracking-wide">New conversation about</h3>
        <div className="space-y-1">
          {options.map(o => (
            <button
              key={o.link.scope} onClick={() => start(o.link)} disabled={s.sending}
              className="w-full flex items-start gap-2 p-2 rounded-md border border-gray-200 text-left hover:border-blue-300 hover:bg-blue-50/40 disabled:opacity-50"
            >
              <MessageSquarePlus size={15} className="mt-0.5 shrink-0 text-blue-600" />
              <span className="min-w-0">
                <span className="block text-sm text-gray-800">{o.label}</span>
                <span className="block text-xs text-gray-500 truncate">{o.link.name}{o.link.scope === 'formulation' && ', all iterations'}</span>
              </span>
            </button>
          ))}
          <button
            onClick={() => start(null)} disabled={s.sending}
            className="w-full flex items-center gap-2 p-2 rounded-md text-left text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <MessageSquarePlus size={15} className="shrink-0 text-gray-400" /> Something else
          </button>
        </div>
      </section>

      {groups.map(g => (
        <section key={g.title}>
          <h3 className="mb-1.5 text-[11px] font-medium text-gray-400 uppercase tracking-wide">{g.title}</h3>
          {g.items.length === 0 ? (
            <p className="text-xs text-gray-500">No conversations yet.</p>
          ) : (
            <ul className="space-y-0.5">
              {g.items.map(c => (
                <li key={c.id}>
                  <button
                    onClick={() => pick(c.id)} disabled={s.sending && c.id !== s.conversationId}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm disabled:opacity-50 ${
                      c.id === s.conversationId ? 'bg-blue-50 text-blue-800' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className="flex-1 min-w-0 truncate" title={c.title}>{c.title}</span>
                    {badge(c) && <span className="shrink-0 max-w-[40%] truncate text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{badge(c)}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <Link href="/sous-chef" onClick={s.closeDock} className="block text-xs text-blue-600 hover:underline">All conversations</Link>
    </div>
  )
}

/** Opens Sous Chef beside this page: the conversation you're in if it's about this page, otherwise the picker */
export function AskSousChefButton() {
  const s = useSousChef()
  const { data: conversations = [] } = useConversations()
  if (s.dockOpen) return null
  const current = conversations.find(c => c.id === s.conversationId)
  const continuing = s.sending || (current && isAboutPage(current, s.page)) || (!s.conversationId && s.draftLink && s.messages.length > 0)
  return (
    <button
      onClick={() => s.showDock(continuing ? 'chat' : 'list')}
      data-tip={s.page ? `Ask Sous Chef about this ${s.page.formulation ? 'formulation' : 'project'}` : 'Ask Sous Chef'}
      className="fixed z-30 right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] sm:bottom-6 sm:right-6 inline-flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full bg-ink-900 text-lcd-300 text-sm font-medium shadow-lg hover:bg-ink-800 print:hidden"
    >
      <ChefHat size={18} />
      <span className="hidden sm:inline">Ask Sous Chef</span>
    </button>
  )
}
