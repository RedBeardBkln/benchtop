import { GLOSSARY, type GlossaryKey } from '@/lib/glossary'

/**
 * A word with a dotted underline whose definition pops up on hover, keyboard focus or tap (shown
 * by TooltipLayer). Pass `t` for a glossary entry, or `tip` for a one-off explanation.
 */
export function Term({ t, tip, children, className = '' }: {
  t?: GlossaryKey
  tip?: string
  children: React.ReactNode
  className?: string
}) {
  const text = tip ?? (t ? GLOSSARY[t] : '')
  if (!text) return <>{children}</>
  return (
    <span
      data-tip={text}
      data-tip-tap=""
      tabIndex={0}
      className={`cursor-help underline decoration-dotted decoration-gray-400 underline-offset-2 outline-none
        focus-visible:ring-1 focus-visible:ring-blue-500 rounded-sm print:no-underline ${className}`}
    >
      {children}
    </span>
  )
}
