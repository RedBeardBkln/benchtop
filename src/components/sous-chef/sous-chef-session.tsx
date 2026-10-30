'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { readErrorMessage } from '@/lib/utils'
import { SOUS_CHEF_NOTE_KINDS, type ConversationLink, type SousChefEvent } from '@/lib/sous-chef'
import { NOTES_KEY } from './lab-notebook'

// The Sous Chef chat you're in, kept above every page (in the root layout's providers) so it carries
// on, mid-reply included, while you move between pages. The Sous Chef page and the side panel on
// project and formulation pages (sous-chef-dock.tsx) are two views of this one session.

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  activity: string[]
  /** Still streaming in */
  pending?: boolean
  error?: string
}

export type ConversationSummary = {
  id: string
  title: string
  projectId: string | null
  formulationFamilyId: string | null
  formulationId: string | null
  updatedAt: string
  link: ConversationLink | null
}

/** The project or formulation iteration the current page shows; set by <SousChefPageContext> */
export type SousChefPage = {
  project: { id: string; name: string }
  formulation?: { id: string; familyId: string; name: string; version: number }
}

export type DockView = 'chat' | 'list'

export const LIST_KEY = ['sous-chef-conversations']

export function useConversations() {
  return useQuery<ConversationSummary[]>({
    queryKey: LIST_KEY,
    queryFn: async () => {
      const r = await fetch('/api/sous-chef/conversations')
      if (!r.ok) throw new Error('Could not load conversations')
      return r.json()
    },
  })
}

/** The links a conversation started on (or moved to) this page can have, most specific first */
export function pageLinkOptions(page: SousChefPage | null): { label: string; link: ConversationLink }[] {
  if (!page) return []
  const { project, formulation: f } = page
  return [
    ...(f ? [
      { label: 'This iteration', link: { scope: 'iteration' as const, id: f.id, name: `${f.name} v${f.version}`, href: `/formulations/${f.id}` } },
      { label: 'The whole formulation', link: { scope: 'formulation' as const, id: f.familyId, name: f.name, href: `/formulations/${f.id}` } },
    ] : []),
    { label: 'The project', link: { scope: 'project' as const, id: project.id, name: project.name, href: `/projects/${project.id}` } },
  ]
}

/** Whether a conversation is about this page's iteration, formulation or project */
export function isAboutPage(c: Pick<ConversationSummary, 'projectId' | 'formulationFamilyId'>, page: SousChefPage | null) {
  if (!page) return false
  return page.formulation
    ? c.formulationFamilyId === page.formulation.familyId || (c.projectId === page.project.id && !c.formulationFamilyId)
    : c.projectId === page.project.id
}

type Session = {
  conversationId: string | null
  messages: ChatMessage[]
  loading: boolean
  sending: boolean
  /** What a new conversation will be about, until its first message is sent */
  draftLink: ConversationLink | null
  setDraftLink: (link: ConversationLink | null) => void
  /** What's typed but not sent; survives moving between pages */
  input: string
  setInput: (text: string) => void
  /** Opens a saved conversation, or with null starts a new one about `link` */
  open: (id: string | null, link?: ConversationLink | null) => void
  send: (text: string) => Promise<void>
  dockOpen: boolean
  dockView: DockView
  showDock: (view: DockView) => void
  closeDock: () => void
  page: SousChefPage | null
  setPage: (page: SousChefPage | null) => void
  /** Set while the page has unsaved changes, so a link in the chat asks before leaving */
  setUnsaved: (unsaved: boolean) => void
  /** Follows a link in a reply: keeps the chat in the side panel and checks for unsaved changes */
  followLink: (e: React.MouseEvent, href: string) => void
  reset: () => void
}

const SessionContext = createContext<Session | null>(null)

export function useSousChef() {
  const s = useContext(SessionContext)
  if (!s) throw new Error('useSousChef must be used inside SousChefProvider')
  return s
}

// The open conversation and panel are remembered for the browser tab, so a reload brings them back
const STORAGE_KEY = 'sous-chef-session'

export function SousChefProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [draftLink, setDraftLink] = useState<ConversationLink | null>(null)
  const [input, setInput] = useState('')
  const [dockOpen, setDockOpen] = useState(false)
  const [dockView, setDockView] = useState<DockView>('list')
  const [page, setPage] = useState<SousChefPage | null>(null)
  const unsavedRef = useRef(false)
  // Ignores a conversation that finishes loading after another was opened
  const loadSeq = useRef(0)
  // Something was opened before the remembered session was restored; don't override it
  const touched = useRef(false)

  const load = useCallback((id: string) => {
    const seq = ++loadSeq.current
    setLoading(true)
    fetch(`/api/sous-chef/conversations/${id}`)
      .then(async r => {
        if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not open that conversation'))
        return r.json() as Promise<{ messages: ChatMessage[] }>
      })
      .then(d => { if (seq === loadSeq.current) setMessages(d.messages) })
      .catch((e: Error) => { if (seq === loadSeq.current) { toast.error(e.message); setConversationId(null) } })
      .finally(() => { if (seq === loadSeq.current) setLoading(false) })
  }, [])

  const open = useCallback((id: string | null, link: ConversationLink | null = null) => {
    touched.current = true
    if (sending) return
    loadSeq.current++
    setLoading(false)
    setMessages([])
    setConversationId(id)
    setDraftLink(id ? null : link)
    if (id) load(id)
  }, [sending, load])

  useEffect(() => {
    if (touched.current) return
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null') as { conversationId?: string | null; dockOpen?: boolean } | null
      if (saved?.conversationId) { setConversationId(saved.conversationId); load(saved.conversationId) }
      if (saved?.dockOpen) { setDockOpen(true); setDockView(saved.conversationId ? 'chat' : 'list') }
    } catch {}
  }, [load])

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ conversationId, dockOpen })) } catch {}
  }, [conversationId, dockOpen])

  const patchLast = (fn: (m: ChatMessage) => ChatMessage) =>
    setMessages(ms => ms.length ? [...ms.slice(0, -1), fn(ms[ms.length - 1])] : ms)

  async function send(text: string) {
    const message = text.trim()
    if (!message || sending) return
    touched.current = true
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
          link: !conversationId && draftLink ? { scope: draftLink.scope, id: draftLink.id } : null,
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
            setDraftLink(null)
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
    }
  }

  const showDock = useCallback((view: DockView) => { setDockView(view); setDockOpen(true) }, [])

  function followLink(e: React.MouseEvent, href: string) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    const go = () => {
      unsavedRef.current = false
      // Leaving the Sous Chef page: carry the conversation on in the side panel
      if (pathname === '/sous-chef') showDock('chat')
      router.push(href)
    }
    if (unsavedRef.current) {
      toast.warning('This formulation has unsaved changes', {
        description: 'Save them first, or leave and lose them.',
        action: { label: 'Leave anyway', onClick: go },
      })
      return
    }
    go()
  }

  function reset() {
    touched.current = true
    loadSeq.current++
    setConversationId(null)
    setMessages([])
    setDraftLink(null)
    setInput('')
    setDockOpen(false)
    try { sessionStorage.removeItem(STORAGE_KEY) } catch {}
  }

  const setUnsaved = useCallback((unsaved: boolean) => { unsavedRef.current = unsaved }, [])

  const value: Session = {
    conversationId, messages, loading, sending, draftLink, setDraftLink, input, setInput, open, send,
    dockOpen, dockView, showDock, closeDock: () => setDockOpen(false), page, setPage, setUnsaved, followLink, reset,
  }
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

/** Tells Sous Chef which project or formulation iteration this page shows */
export function SousChefPageContext(props: SousChefPage) {
  const { setPage } = useSousChef()
  const key = JSON.stringify(props)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const page = useMemo(() => props, [key])
  useEffect(() => {
    setPage(page)
    return () => setPage(null)
  }, [page, setPage])
  return null
}

/** While `unsaved`, links in the chat ask before leaving the page */
export function useSousChefUnsavedGuard(unsaved: boolean) {
  const { setUnsaved } = useSousChef()
  useEffect(() => {
    setUnsaved(unsaved)
    return () => setUnsaved(false)
  }, [unsaved, setUnsaved])
}
