import { LOGO_MARK, LOGO_WORDMARK } from '@/lib/brand'

// The Benchtop logo: a "B" mark or "BENCHTOP" wordmark in the DS-Digital LCD font, drawn from
// its glyph outlines. `height` is the cap height in px. Color comes from `currentColor`.
export function Logo({
  variant = 'mark',
  height = 32,
  className,
}: {
  variant?: 'mark' | 'wordmark'
  height?: number
  className?: string
}) {
  const { box, d } = variant === 'mark' ? LOGO_MARK : LOGO_WORDMARK
  return (
    <span role="img" aria-label="Benchtop" className={`inline-flex ${className ?? ''}`}>
      <svg
        viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
        style={{ display: 'block', height, width: (height * box.width) / box.height }}
        aria-hidden="true"
      >
        <path d={d} fill="currentColor" />
      </svg>
    </span>
  )
}
