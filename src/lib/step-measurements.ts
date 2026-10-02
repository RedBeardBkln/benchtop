// Pure helpers for the measurements recorded on a process step — no side effects, fully testable.
// Everything lives in the step's `params` JSON as strings, except equipment (a real FK on the step).

export type StepParams = {
  start_time?: string   // time of day, "HH:mm"
  end_time?: string
  ph?: string
  temp_c?: string       // canonical temperature; °F is always derived from it
  time?: string         // duration, "hh:mm:ss"
  speed?: string        // 2 decimals
  notes?: string
  // Older / less common fields, still editable under the step's expander
  time_min?: string     // legacy duration in minutes — read as a fallback for `time`
  solids_pct?: string
  shear?: string
  pressure?: string
}

export const cToF = (c: number) => (c * 9) / 5 + 32
export const fToC = (f: number) => ((f - 32) * 5) / 9

/** Trim a number to `dp` decimals without trailing zeros: 185 → "185", 176.6667 → "176.67". */
export function trimNumber(n: number, dp: number): string {
  return String(Number(n.toFixed(dp)))
}

/**
 * Normalise a duration to "hh:mm:ss". Accepts "h:mm:ss" or "mm:ss" (read as minutes:seconds).
 * Returns null when it isn't a valid duration.
 */
export function normalizeTime(raw: string): string | null {
  const parts = raw.trim().split(':')
  if (parts.length < 2 || parts.length > 3 || parts.some(p => !/^\d{1,3}$/.test(p))) return null
  const [h, m, s] = parts.length === 3 ? parts.map(Number) : [0, ...parts.map(Number)]
  if (m > 59 || s > 59 || h > 999) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

/** Minutes (legacy `time_min`) → "hh:mm:ss", or null if not a usable number. */
export function minutesToTime(minutes: string): string | null {
  const total = Math.round(parseFloat(minutes) * 60)
  if (!Number.isFinite(total) || total < 0) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
}

/** The step's duration for display: `time`, else the legacy minutes value converted. */
export function stepTime(p: StepParams): string | null {
  if (p.time) return p.time
  return p.time_min ? minutesToTime(p.time_min) : null
}

const TIME_OF_DAY_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/

/** Why a params patch can't be saved, or null when every value is acceptable. null/'' values mean "clear". */
export function paramPatchError(patch: Record<string, string | null | undefined>): string | null {
  const num = (v: string) => (v.trim() === '' ? NaN : Number(v))
  for (const [key, value] of Object.entries(patch)) {
    if (value == null || value === '') continue
    switch (key) {
      case 'ph': {
        const n = num(value)
        if (!(n >= 0 && n <= 14)) return 'pH must be between 0 and 14'
        break
      }
      case 'temp_c':
        if (!Number.isFinite(num(value))) return 'Temperature must be a number'
        break
      case 'speed':
        if (!(num(value) >= 0)) return 'Speed must be a number, 0 or greater'
        break
      case 'time':
        if (normalizeTime(value) !== value) return 'Time must be hh:mm:ss'
        break
      case 'start_time':
      case 'end_time':
        if (!TIME_OF_DAY_RE.test(value)) return 'Start/end must be a time like 14:05'
        break
    }
  }
  return null
}

export type MeasurementBox = {
  label: string
  /** Empty string = leave the box blank so it can be filled in by hand. */
  value: string
  /** Width in a 12-column row. */
  span: number
  /** Tall box for free text. */
  tall?: boolean
}

/**
 * The boxes to print for a step. The tracked measurements always appear — blank when there is
 * no value, so they can be written in at the bench. Solids/shear/pressure only appear when set.
 */
export function stepMeasurementBoxes(p: StepParams, equipmentName: string | null): MeasurementBox[] {
  const c = p.temp_c != null && p.temp_c !== '' ? parseFloat(p.temp_c) : NaN
  const boxes: MeasurementBox[] = [
    { label: 'Start', value: p.start_time ?? '', span: 3 },
    { label: 'End', value: p.end_time ?? '', span: 3 },
    { label: 'pH', value: p.ph ?? '', span: 2 },
    { label: 'Temp (°C)', value: Number.isFinite(c) ? trimNumber(c, 2) : '', span: 2 },
    { label: 'Temp (°F)', value: Number.isFinite(c) ? trimNumber(cToF(c), 1) : '', span: 2 },
    { label: 'Time (hh:mm:ss)', value: stepTime(p) ?? '', span: 3 },
    { label: 'Speed', value: p.speed ?? '', span: 2 },
    { label: 'Equipment', value: equipmentName ?? '', span: 7 },
  ]
  const extras: Array<[string, string | undefined]> = [
    ['Solids (%)', p.solids_pct], ['Shear', p.shear], ['Pressure', p.pressure],
  ]
  for (const [label, value] of extras) if (value) boxes.push({ label, value, span: 4 })
  boxes.push({ label: 'Notes', value: p.notes ?? '', span: 12, tall: true })
  return boxes
}
