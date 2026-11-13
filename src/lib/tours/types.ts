// A page tour: up to six post-it notes, each pinned to an element marked data-tour="<target>".
// A step without a target (or whose element isn't on screen) shows unpinned, centered.

export const TOUR_MAX_STEPS = 6

export type TourStep = {
  /** data-tour value of the element the note points at */
  target?: string
  title: string
  body: string
}

export type Tour = {
  /** Stable id stored in preferences once seen; change it to show a rewritten tour again */
  id: string
  /** Paths the tour belongs to; ":param" matches one segment, e.g. "/projects/:id" */
  paths: string[]
  steps: TourStep[]
}
