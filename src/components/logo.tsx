import { LOGO_SEGMENTS, LOGO_VIEWBOX } from '@/lib/brand'

// The benchtop mark: an LCD-segment "b". In the wordmark the mark *is* the "b",
// followed by "enchtop" set in the display face. Colour comes from `currentColor`.
export function Logo({
  variant = 'mark',
  height = 32,
  className,
}: {
  variant?: 'mark' | 'wordmark'
  height?: number
  className?: string
}) {
  const mark = (h: number) => (
    <svg
      viewBox={`0 0 ${LOGO_VIEWBOX.width} ${LOGO_VIEWBOX.height}`}
      style={{ display: 'block', height: h, width: (h * LOGO_VIEWBOX.width) / LOGO_VIEWBOX.height }}
      aria-hidden="true"
    >
      {LOGO_SEGMENTS.map((p) => (
        <polygon key={p} points={p} fill="currentColor" />
      ))}
    </svg>
  )

  if (variant === 'mark') {
    return (
      <span role="img" aria-label="benchtop" className={`inline-flex ${className ?? ''}`}>
        {mark(height)}
      </span>
    )
  }

  return (
    <span
      role="img"
      aria-label="benchtop"
      className={`inline-flex items-baseline font-display font-bold leading-none ${className ?? ''}`}
      style={{ gap: height * 0.06, fontSize: height, letterSpacing: '-0.04em' }}
    >
      {mark(height * 0.82)}
      <span aria-hidden="true">enchtop</span>
    </span>
  )
}
