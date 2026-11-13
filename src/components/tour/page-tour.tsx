'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import localFont from 'next/font/local'
import { tourForPath, type Tour, type TourStep } from '@/lib/tours'
import { usePreferences } from '@/lib/use-preferences'

// Page tours: a short run of post-it notes, each stuck beside the part of the page it explains,
// with the rest of the page dimmed. One tour per page (lib/tours). It starts by itself the first
// time a page is opened (unless turned off in Settings › Preferences), and "Page tour" at the foot of
// the page replays it. Finishing or dismissing it marks it seen for this user on every device.
//
// The note is lime and ink in both themes, like the brand's lit LCD, so its colors are fixed hex
// values rather than theme tokens (which swap in dark mode).

const segment = localFont({ src: '../../fonts/DS-Digital-Bold.ttf', display: 'swap' })

export const START_TOUR_EVENT = 'benchtop:start-tour'

/** Ask the tour on this page to start (used by the "Page tour" link) */
export function startPageTour() {
  window.dispatchEvent(new Event(START_TOUR_EVENT))
}

const NOTE_WIDTH = 300
const GAP = 14 // between the highlighted element and the note
const EDGE = 16 // minimum distance from the viewport edge
const PAD = 6 // highlight padding around the element

const findTarget = (step: TourStep): HTMLElement | null => {
  if (!step.target) return null
  // The first visible match: some targets exist twice, once for phones and once for larger screens
  const els = document.querySelectorAll<HTMLElement>(`[data-tour="${CSS.escape(step.target)}"]`)
  for (const el of els) if (el.getClientRects().length > 0) return el
  return null
}

/** Waits for the page to render its targets (data often loads after the page), then keeps the steps that can show */
async function resolveSteps(tour: Tour, isCurrent: () => boolean): Promise<TourStep[]> {
  // Up to 4s for everything, but once some targets are up, 1.2s is enough: the rest may never show
  // (an owner-only button, say)
  const targeted = tour.steps.filter(s => s.target)
  const started = Date.now()
  while (isCurrent()) {
    const found = targeted.filter(s => findTarget(s)).length
    const waited = Date.now() - started
    if (found === targeted.length || waited > 4000 || (found > 0 && waited > 1200)) break
    await new Promise(r => setTimeout(r, 200))
  }
  return tour.steps.filter(s => !s.target || findTarget(s))
}

type Active = { tour: Tour; steps: TourStep[]; index: number }

export function PageTour() {
  const pathname = usePathname()
  const tour = tourForPath(pathname)
  const { prefs, isLoading, setPrefs } = usePreferences()
  const [active, setActive] = useState<Active | null>(null)
  const run = useRef(0) // guards against a page change while steps are resolving

  const start = useCallback(async (t: Tour) => {
    const id = ++run.current
    const steps = await resolveSteps(t, () => run.current === id)
    if (run.current !== id || steps.length === 0) return
    setActive({ tour: t, steps, index: 0 })
  }, [])

  // A new page ends whatever tour was showing
  useEffect(() => {
    run.current++
    setActive(null)
  }, [pathname])

  // First visit: start on its own once preferences have loaded
  const seen = prefs.toursSeen
  useEffect(() => {
    if (isLoading || !tour || !prefs.pageTours || seen.includes(tour.id)) return
    const t = setTimeout(() => start(tour), 600)
    return () => clearTimeout(t)
  }, [isLoading, tour, prefs.pageTours, seen, start])

  // "Page tour" link
  useEffect(() => {
    if (!tour) return
    const onStart = () => start(tour)
    window.addEventListener(START_TOUR_EVENT, onStart)
    return () => window.removeEventListener(START_TOUR_EVENT, onStart)
  }, [tour, start])

  const finish = useCallback(() => {
    if (!active) return
    if (!seen.includes(active.tour.id)) setPrefs({ toursSeen: [...seen, active.tour.id] })
    setActive(null)
  }, [active, seen, setPrefs])

  if (!active) return null
  const step = active.steps[active.index]
  return (
    <TourNote
      step={step}
      index={active.index}
      count={active.steps.length}
      onNext={() => (active.index + 1 < active.steps.length ? setActive({ ...active, index: active.index + 1 }) : finish())}
      onDismiss={finish}
    />
  )
}

type Box = { top: number; left: number; width: number; height: number }

function TourNote({ step, index, count, onNext, onDismiss }: {
  step: TourStep
  index: number
  count: number
  onNext: () => void
  onDismiss: () => void
}) {
  const noteRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const [target, setTarget] = useState<Box | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  // Glide between steps, but not into the first position
  const [glide, setGlide] = useState(false)
  useEffect(() => {
    if (!pos || glide) return
    const f = requestAnimationFrame(() => setGlide(true))
    return () => cancelAnimationFrame(f)
  }, [pos, glide])
  const last = index + 1 === count
  // Each note sits a touch crooked, alternating, like notes stuck on by hand
  const tilt = index % 2 === 0 ? -1.2 : 1

  // Bring the element into view, then follow it as the page scrolls or resizes
  useLayoutEffect(() => {
    const el = findTarget(step)
    el?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' })
    let frame = 0
    const measure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const live = findTarget(step)
        if (!live) return setTarget(null)
        const r = live.getBoundingClientRect()
        setTarget({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 })
      })
    }
    measure()
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  }, [step])

  // Place the note below the element, else above, else beside it, always inside the viewport
  useLayoutEffect(() => {
    const note = noteRef.current
    if (!note) return
    const vw = window.innerWidth
    const vh = window.innerHeight
    const w = note.offsetWidth
    const h = note.offsetHeight
    const clampX = (x: number) => Math.min(Math.max(x, EDGE), vw - w - EDGE)
    const clampY = (y: number) => Math.min(Math.max(y, EDGE), vh - h - EDGE)
    if (!target) {
      setPos({ top: clampY((vh - h) / 2), left: clampX((vw - w) / 2) })
      return
    }
    const below = target.top + target.height + GAP
    const above = target.top - GAP - h
    if (below + h <= vh - EDGE) setPos({ top: below, left: clampX(target.left) })
    else if (above >= EDGE) setPos({ top: above, left: clampX(target.left) })
    else {
      const right = target.left + target.width + GAP
      const left = right + w <= vw - EDGE ? right : target.left - GAP - w
      setPos({ top: clampY(target.top), left: clampX(left) })
    }
  }, [target, step])

  useEffect(() => { nextRef.current?.focus({ preventScroll: true }) }, [])

  return (
    <div
      className="fixed inset-0 z-[150] print:hidden"
      onKeyDown={e => {
        if (e.key === 'Escape') onDismiss()
        if (e.key === 'ArrowRight') onNext()
      }}
    >
      {/* Dimmed page with a lit window around the element. It catches clicks so the page stays put mid-tour. */}
      {target ? (
        <div
          aria-hidden
          className={`absolute rounded-lg pointer-events-none ${glide ? 'transition-all duration-300 ease-out' : ''}`}
          style={{
            top: target.top,
            left: target.left,
            width: target.width,
            height: target.height,
            boxShadow: '0 0 0 3px #D6F55A, 0 0 0 9999px rgb(14 21 9 / 0.55)',
          }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-[rgb(14_21_9/0.55)]" />
      )}

      <div
        ref={noteRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className={`absolute ${glide ? 'transition-[top,left] duration-300 ease-out' : ''}`}
        style={{
          top: pos?.top ?? -9999,
          left: pos?.left ?? -9999,
          width: `min(${NOTE_WIDTH}px, calc(100vw - ${EDGE * 2}px))`,
          visibility: pos ? 'visible' : 'hidden',
        }}
      >
        <div
          className="relative px-5 pt-6 pb-4 text-[#16200E]"
          style={{
            transform: `rotate(${tilt}deg)`,
            // Lime post-it: a faint fold line near the top, darker toward the curled lower corner
            background: 'linear-gradient(180deg, #E6FA84 0%, #E6FA84 18%, #DFF57A 19%, #D6F55A 100%)',
            borderRadius: '2px 2px 2px 18px / 2px 2px 2px 10px',
            boxShadow: '0 1px 1px rgb(22 32 14 / 0.12), 0 10px 18px -6px rgb(22 32 14 / 0.45), inset 0 -10px 18px -14px rgb(22 32 14 / 0.35)',
          }}
        >
          {/* Strip of tape holding the note on */}
          <span
            aria-hidden
            className="absolute -top-3 left-1/2 h-6 w-24"
            style={{
              transform: `translateX(-50%) rotate(${-tilt * 2}deg)`,
              background: 'rgb(255 253 246 / 0.6)',
              boxShadow: '0 1px 2px rgb(22 32 14 / 0.15)',
              backdropFilter: 'blur(1px)',
            }}
          />

          <div className="flex items-center justify-between gap-3 mb-2">
            <span
              className={`${segment.className} text-[17px] leading-none tracking-wider`}
              aria-label={`Step ${index + 1} of ${count}`}
            >
              {index + 1} of {count}
            </span>
            <span aria-hidden className="flex gap-1">
              {Array.from({ length: count }, (_, i) => (
                <span key={i} className={`h-1.5 w-3 rounded-full ${i <= index ? 'bg-[#16200E]' : 'bg-[#16200E]/20'}`} />
              ))}
            </span>
          </div>

          <h2 id="tour-title" className="text-[17px] font-semibold leading-snug">{step.title}</h2>
          <p id="tour-body" className="mt-1.5 text-sm leading-relaxed text-[#243319]">{step.body}</p>

          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onDismiss}
              data-tip="Closes this page’s tour. Replay it any time with “Page tour” at the foot of the page."
              className="text-xs font-medium text-[#384D28] underline decoration-[#16200E]/30 underline-offset-2 hover:text-[#16200E]"
            >
              Dismiss tutorial
            </button>
            <button
              ref={nextRef}
              type="button"
              onClick={onNext}
              className="px-4 py-1.5 rounded-md text-sm font-semibold bg-[#16200E] text-[#D6F55A] border-[1.5px] border-[#16200E] shadow-[3px_3px_0_rgb(22_32_14/0.35)] hover:-translate-y-px active:translate-y-px active:shadow-none transition-transform"
            >
              {last ? 'Done' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
