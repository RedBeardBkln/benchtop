'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * A box that scrolls sideways, with its scrollbar pinned to the bottom of the screen while the box is
 * in view, so a long table can be scrolled left and right without going to its last row. The box's own
 * scrollbar is hidden in favor of this one, which follows it. Nothing shows when the content fits.
 */
export function StickyXScroll({ className, children }: { className?: string; children: React.ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const [scrollWidth, setScrollWidth] = useState(0)
  const [overflows, setOverflows] = useState(false)
  // Which side moved last, so the echo from syncing the other side is ignored
  const syncing = useRef<'box' | 'bar' | null>(null)

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const measure = () => {
      setScrollWidth(box.scrollWidth)
      setOverflows(box.scrollWidth > box.clientWidth + 1)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    if (box.firstElementChild) ro.observe(box.firstElementChild)
    return () => ro.disconnect()
  }, [])

  // The bar appears after the first measure; start it where the box already is
  useEffect(() => {
    if (overflows && barRef.current && boxRef.current) barRef.current.scrollLeft = boxRef.current.scrollLeft
  }, [overflows])

  function follow(from: 'box' | 'bar') {
    const src = from === 'box' ? boxRef.current : barRef.current
    const dst = from === 'box' ? barRef.current : boxRef.current
    if (!src || !dst) return
    if (syncing.current && syncing.current !== from) { syncing.current = null; return }
    // Already in step: setting it would fire no scroll event, leaving the echo guard set
    if (dst.scrollLeft === src.scrollLeft) return
    syncing.current = from
    dst.scrollLeft = src.scrollLeft
  }

  return (
    <div>
      <div
        ref={boxRef}
        onScroll={() => follow('box')}
        className={`overflow-x-auto ${overflows ? 'scrollbar-none' : ''} ${className ?? ''}`}
      >
        {children}
      </div>
      {overflows && (
        <div
          ref={barRef}
          onScroll={() => follow('bar')}
          aria-hidden="true"
          // Above the phone's bottom menu bar; at the screen's bottom edge on larger screens
          className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] sm:bottom-0 z-20 overflow-x-auto overflow-y-hidden bg-white/90 print:hidden"
        >
          <div style={{ width: scrollWidth, height: 1 }} />
        </div>
      )}
    </div>
  )
}
