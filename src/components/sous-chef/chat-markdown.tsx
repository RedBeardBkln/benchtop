'use client'

import { createContext, Fragment, useContext, useMemo } from 'react'
import { parseMarkdown, type Inline } from '@/lib/chat-markdown'

type LinkHandler = (e: React.MouseEvent, href: string) => void
// Handles clicks on links into Formul8 (e.g. /formulations/<id>) so the chat isn't lost
const InternalLink = createContext<LinkHandler | undefined>(undefined)

function Spans({ items }: { items: Inline[] }) {
  const onInternalLink = useContext(InternalLink)
  return (
    <>
      {items.map((n, i) => {
        switch (n.t) {
          case 'text': return <Fragment key={i}>{n.v}</Fragment>
          case 'strong': return <strong key={i} className="font-semibold"><Spans items={n.c} /></strong>
          case 'em': return <em key={i}><Spans items={n.c} /></em>
          case 'code': return <code key={i} className="px-1 py-0.5 rounded bg-gray-100 text-[0.85em] font-mono">{n.v}</code>
          case 'link': {
            const external = /^https?:/i.test(n.href)
            const internal = n.href.startsWith('/') && !n.href.startsWith('//')
            return (
              <a key={i} href={n.href} className="text-blue-600 hover:underline break-words"
                {...(external && { target: '_blank', rel: 'noopener noreferrer' })}
                {...(internal && onInternalLink && { onClick: (e: React.MouseEvent) => onInternalLink(e, n.href) })}>
                <Spans items={n.c} />
              </a>
            )
          }
        }
      })}
    </>
  )
}

/** A Sous Chef reply, rendered from Markdown without ever injecting HTML */
export function ChatMarkdown({ text, onInternalLink }: { text: string; onInternalLink?: LinkHandler }) {
  const blocks = useMemo(() => parseMarkdown(text), [text])
  return (
    <InternalLink.Provider value={onInternalLink}>
      <div className="space-y-3 text-sm leading-relaxed text-gray-800">
        {blocks.map((b, i) => {
          switch (b.t) {
            case 'h':
              return b.level === 1
                ? <h3 key={i} className="text-base font-semibold text-gray-900 pt-1"><Spans items={b.c} /></h3>
                : <h4 key={i} className="text-sm font-semibold text-gray-900 pt-1"><Spans items={b.c} /></h4>
            case 'p': return <p key={i}><Spans items={b.c} /></p>
            case 'ul':
              return <ul key={i} className="list-disc pl-5 space-y-1">{b.items.map((it, j) => <li key={j}><Spans items={it} /></li>)}</ul>
            case 'ol':
              return <ol key={i} start={b.start} className="list-decimal pl-5 space-y-1">{b.items.map((it, j) => <li key={j}><Spans items={it} /></li>)}</ol>
            case 'quote':
              return <blockquote key={i} className="border-l-2 border-gray-300 pl-3 text-gray-600"><Spans items={b.c} /></blockquote>
            case 'code':
              return <pre key={i} className="p-3 rounded-md bg-gray-50 border border-gray-200 text-xs font-mono overflow-x-auto whitespace-pre">{b.v}</pre>
            case 'hr': return <hr key={i} className="border-gray-200" />
            case 'table':
              return (
                <div key={i} className="overflow-x-auto">
                  <table className="text-xs border-collapse min-w-full">
                    <thead>
                      <tr>{b.head.map((c, j) => <th key={j} className="text-left font-semibold px-2 py-1.5 border-b border-gray-300 bg-gray-50"><Spans items={c} /></th>)}</tr>
                    </thead>
                    <tbody>
                      {b.rows.map((r, j) => (
                        <tr key={j}>{r.map((c, k) => <td key={k} className="px-2 py-1.5 border-b border-gray-100 align-top"><Spans items={c} /></td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
          }
        })}
      </div>
    </InternalLink.Provider>
  )
}
