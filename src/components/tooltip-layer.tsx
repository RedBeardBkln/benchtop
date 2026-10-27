'use client'

import { useEffect, useRef, useState } from 'react'

// One tooltip for the whole app. Any element with `data-tip="…"` shows that text on hover (after a
// short delay) and on keyboard focus; `Term` (components/term.tsx) adds tap-to-show for touch
// screens. Plain `title` attributes are upgraded on first hover, so the browser's slow, unstyled
// tooltip never appears and older hints get the same look. Escape, scrolling or a click hides it.

const SHOW_DELAY_MS = 350
// Moving straight from one tip to the next shows it at once
const WARM_MS = 600
const MAX_W = 280
const GAP = 8

type Shown = { text: string; top: number; left: number; above: boolean; arrowLeft: number }

const TIP_ID = 'app-tooltip'

// Moves a native title into data-tip-auto (keeping an accessible name for icon-only controls)
function upgradeTitle(el: Element): void {
  const title = el.getAttribute('title')
  if (!title || el.tagName === 'IFRAME' || el.closest('svg')) return
  el.setAttribute('data-tip-auto', title)
  el.removeAttribute('title')
  if (!el.getAttribute('aria-label') && !(el.textContent ?? '').trim()) el.setAttribute('aria-label', title)
}

function tipTarget(node: EventTarget | null): HTMLElement | null {
  if (!(node instanceof Element)) return null
  const titled = node.closest('[title]')
  if (titled && !titled.closest('[data-tip]')) upgradeTitle(titled)
  return node.closest<HTMLElement>('[data-tip], [data-tip-auto]')
}

const tipText = (el: HTMLElement) => (el.getAttribute('data-tip') || el.getAttribute('data-tip-auto') || '').trim()

function place(el: HTMLElement, text: string, bubble: HTMLElement | null): Shown {
  const r = el.getBoundingClientRect()
  const w = bubble?.offsetWidth ?? Math.min(MAX_W, window.innerWidth - 16)
  const h = bubble?.offsetHeight ?? 48
  const center = r.left + r.width / 2
  const left = Math.max(8, Math.min(center - w / 2, window.innerWidth - w - 8))
  const above = r.bottom + GAP + h > window.innerHeight && r.top - GAP - h > 0
  const top = above ? r.top - GAP - h : r.bottom + GAP
  return { text, top, left, above, arrowLeft: Math.max(10, Math.min(center - left, w - 10)) }
}

export function TooltipLayer() {
  const [shown, setShown] = useState<Shown | null>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLElement | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastHiddenRef = useRef(0)

  useEffect(() => {
    function clearTimer() {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
    }
    function hide() {
      clearTimer()
      if (anchorRef.current) {
        anchorRef.current.removeAttribute('aria-describedby')
        lastHiddenRef.current = Date.now()
      }
      anchorRef.current = null
      setShown(null)
    }
    function show(el: HTMLElement, immediate: boolean) {
      const text = tipText(el)
      if (!text) return
      clearTimer()
      const go = () => {
        anchorRef.current?.removeAttribute('aria-describedby')
        anchorRef.current = el
        el.setAttribute('aria-describedby', TIP_ID)
        setShown(place(el, text, null))
      }
      if (immediate || Date.now() - lastHiddenRef.current < WARM_MS) go()
      else timerRef.current = setTimeout(go, SHOW_DELAY_MS)
    }

    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const el = tipTarget(e.target)
      if (!el) { if (anchorRef.current || timerRef.current) hide(); return }
      if (el !== anchorRef.current) show(el, false)
    }
    const onFocusIn = (e: FocusEvent) => {
      const el = tipTarget(e.target)
      // Keyboard focus only; a mouse click shouldn't pop a tip over what was just clicked
      if (el && (e.target as Element).matches?.(':focus-visible')) show(el, true)
    }
    const onFocusOut = () => { if (anchorRef.current) hide() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && anchorRef.current) hide() }
    // Touch: a Term toggles its tip on tap; any other tap closes an open one
    const onClick = (e: MouseEvent) => {
      const term = (e.target as Element | null)?.closest?.<HTMLElement>('[data-tip-tap]')
      if (term && (e as PointerEvent).pointerType !== 'mouse') {
        if (anchorRef.current === term) hide()
        else show(term, true)
        return
      }
      if (anchorRef.current) hide()
    }
    const onScroll = () => { if (anchorRef.current) hide() }

    document.addEventListener('pointerover', onOver)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    document.addEventListener('keydown', onKey)
    document.addEventListener('click', onClick, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      clearTimer()
      document.removeEventListener('pointerover', onOver)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  // Re-place once the bubble's real height is known (it may need to flip above the anchor)
  useEffect(() => {
    if (!shown || !anchorRef.current || !bubbleRef.current) return
    const next = place(anchorRef.current, shown.text, bubbleRef.current)
    if (next.top !== shown.top || next.above !== shown.above || next.left !== shown.left) setShown(next)
  }, [shown])

  // The anchor can disappear under a still mouse (a dialog closing); don't leave its tip behind
  useEffect(() => {
    if (!shown) return
    const t = setInterval(() => {
      if (anchorRef.current && !anchorRef.current.isConnected) {
        anchorRef.current = null
        setShown(null)
      }
    }, 400)
    return () => clearInterval(t)
  }, [shown])

  if (!shown) return null
  return (
    <div
      ref={bubbleRef}
      id={TIP_ID}
      role="tooltip"
      className="fixed z-[200] pointer-events-none rounded-md bg-gray-900 px-2.5 py-1.5 text-xs leading-snug text-gray-50 shadow-lg print:hidden"
      style={{ top: shown.top, left: shown.left, maxWidth: Math.min(MAX_W, typeof window === 'undefined' ? MAX_W : window.innerWidth - 16) }}
    >
      {shown.text}
      <span
        aria-hidden
        className="absolute h-2 w-2 rotate-45 bg-gray-900"
        style={{ left: shown.arrowLeft - 4, ...(shown.above ? { bottom: -4 } : { top: -4 }) }}
      />
    </div>
  )
}
