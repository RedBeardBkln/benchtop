import Link from 'next/link'
import { AlertTriangle, Info, Lightbulb } from 'lucide-react'
import type { HelpBlock } from '@/lib/help/types'

// Renders the inline markup used in help text: **bold**, `UI label` and [link](/path).
// Links starting with / stay inside the app; anything else opens in a new tab.
export function HelpText({ text }: { text: string }) {
  const parts: React.ReactNode[] = []
  const re = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g
  let last = 0
  let m: RegExpExecArray | null
  let k = 0
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    if (m[1]) {
      const href = m[2]
      parts.push(
        href.startsWith('/') || href.startsWith('#') ? (
          <Link key={k++} href={href} className="text-blue-700 underline decoration-blue-300 underline-offset-2 hover:decoration-blue-700">
            {m[1]}
          </Link>
        ) : (
          <a key={k++} href={href} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline decoration-blue-300 underline-offset-2 hover:decoration-blue-700">
            {m[1]}
          </a>
        ),
      )
    } else if (m[3]) {
      parts.push(<strong key={k++} className="font-semibold text-gray-900">{m[3]}</strong>)
    } else if (m[4]) {
      parts.push(
        <span key={k++} className="inline-block px-1.5 py-px rounded border border-gray-300 bg-gray-50 text-[0.85em] font-medium text-gray-800 whitespace-nowrap">
          {m[4]}
        </span>,
      )
    }
    last = re.lastIndex
  }
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}

const CALLOUT = {
  tip: { icon: Lightbulb, label: 'Tip', cls: 'bg-lcd-50 border-lcd-400 text-gray-900', iconCls: 'text-lcd-600' },
  note: { icon: Info, label: 'Good to know', cls: 'bg-blue-50 border-blue-200 text-blue-950', iconCls: 'text-blue-600' },
  warning: { icon: AlertTriangle, label: 'Careful', cls: 'bg-amber-50 border-amber-300 text-amber-950', iconCls: 'text-amber-600' },
} as const

export function HelpBlocks({ blocks }: { blocks: HelpBlock[] }) {
  return (
    <div className="space-y-3 text-[15px] leading-relaxed text-gray-700">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'p':
            return <p key={i}><HelpText text={b.text} /></p>
          case 'h':
            return <h4 key={i} className="pt-2 text-base font-semibold text-gray-900"><HelpText text={b.text} /></h4>
          case 'steps':
            return (
              <ol key={i} className="space-y-2">
                {b.items.map((s, j) => (
                  <li key={j} className="flex gap-3">
                    <span className="mt-0.5 shrink-0 w-6 h-6 rounded-full bg-ink-900 text-lcd-300 text-xs font-semibold flex items-center justify-center tabular-nums">
                      {j + 1}
                    </span>
                    <span className="min-w-0"><HelpText text={s} /></span>
                  </li>
                ))}
              </ol>
            )
          case 'list':
            return (
              <ul key={i} className="list-disc pl-5 space-y-1.5 marker:text-gray-400">
                {b.items.map((s, j) => <li key={j}><HelpText text={s} /></li>)}
              </ul>
            )
          case 'terms':
            return (
              <dl key={i} className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
                {b.items.map((t, j) => (
                  <div key={j} className="px-3 py-2 sm:grid sm:grid-cols-[minmax(8rem,14rem)_1fr] sm:gap-4">
                    <dt className="font-medium text-gray-900"><HelpText text={t.term} /></dt>
                    <dd className="text-gray-700"><HelpText text={t.text} /></dd>
                  </div>
                ))}
              </dl>
            )
          default: {
            const c = CALLOUT[b.type]
            const Icon = c.icon
            return (
              <div key={i} className={`flex gap-2.5 rounded-lg border px-3 py-2.5 text-sm ${c.cls}`}>
                <Icon size={16} className={`mt-0.5 shrink-0 ${c.iconCls}`} />
                <div><span className="font-semibold">{c.label}: </span><HelpText text={b.text} /></div>
              </div>
            )
          }
        }
      })}
    </div>
  )
}
