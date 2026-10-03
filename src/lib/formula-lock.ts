// Pure rebalancing for locked quantities, locked usage % and a locked batch size — no side effects.
//
// Each ingredient line plays one role:
//   Q  quantity-locked : keeps its grams
//   P  %-locked        : always `lockedPct` % of the batch
//   F  free            : shares whatever is left
//
// Batch NOT locked: the batch is whatever its parts add up to. P lines scale with it:
//   total = (ΣQ + ΣF) / (1 − ΣP%), and each P line = its % of that total.
// Batch locked at B: P lines = % of B, Q lines keep their grams, and the F lines are scaled
//   (keeping their relative proportions) so that everything adds up to exactly B.
//
// An edit passes an `anchor`: the line being edited keeps the value just typed (as a quantity
// or as a %) and the *other* free lines absorb the change.

export type LockLine = {
  key: string
  weightG: number
  /** Quantity lock. */
  locked: boolean
  pctLocked: boolean
  lockedPct: number | null
}

export type Anchor = { key: string; kind: 'qty' | 'pct'; value: number }

export type ResolveResult = {
  weights: Record<string, number>
  /** Human-readable reason the locks can't all be honoured; weights are left as they were. */
  problem: string | null
  /** The anchor's value had to be reduced/raised to keep the batch consistent. */
  clamped: boolean
}

const r4 = (n: number) => Math.round(n * 1e4) / 1e4
const EPS = 5e-5   // half of the smallest representable weight step (0.0001 g)

type Role = { kind: 'Q' | 'P' | 'F'; p?: number }

export function resolveLines(input: {
  lines: LockLine[]
  batchLocked: boolean
  batchG: number | null
  anchor?: Anchor
}): ResolveResult {
  const { lines, anchor } = input
  const batchLocked = input.batchLocked && input.batchG != null && input.batchG > 0
  const B = batchLocked ? (input.batchG as number) : 0

  const weights: Record<string, number> = {}
  for (const l of lines) weights[l.key] = l.weightG
  const unchanged = (problem: string | null): ResolveResult => ({ weights, problem, clamped: false })

  const roleOf = (l: LockLine): Role => {
    if (anchor && l.key === anchor.key) {
      return anchor.kind === 'qty' ? { kind: 'Q' } : { kind: 'P', p: anchor.value }
    }
    if (l.locked) return { kind: 'Q' }
    if (l.pctLocked && l.lockedPct != null) return { kind: 'P', p: l.lockedPct }
    return { kind: 'F' }
  }
  const roles = new Map(lines.map(l => [l.key, roleOf(l)]))
  const qtyOf = (l: LockLine) => (anchor?.kind === 'qty' && l.key === anchor.key ? anchor.value : l.weightG)

  const P = lines.filter(l => roles.get(l.key)!.kind === 'P')
  const F = lines.filter(l => roles.get(l.key)!.kind === 'F')
  const sumP = P.reduce((s, l) => s + roles.get(l.key)!.p! / 100, 0)
  if (P.length > 0 && sumP >= 1 - 1e-9) {
    return unchanged('Locked percentages add up to 100% or more, leaving nothing for the other ingredients.')
  }

  // ── Batch not locked ───────────────────────────────────────────────────────────────────
  if (!batchLocked) {
    const base = lines
      .filter(l => roles.get(l.key)!.kind !== 'P')
      .reduce((s, l) => s + qtyOf(l), 0)
    const total = base / (1 - sumP)
    for (const l of lines) {
      const role = roles.get(l.key)!
      weights[l.key] = role.kind === 'P' ? r4((role.p! / 100) * total) : r4(qtyOf(l))
    }
    return { weights, problem: null, clamped: false }
  }

  // ── Batch locked at B ─────────────────────────────────────────────────────────────────
  const anchorLine = anchor ? lines.find(l => l.key === anchor.key) : undefined
  const others = lines.filter(l => l !== anchorLine)
  const sumQOthers = others
    .filter(l => roles.get(l.key)!.kind === 'Q')
    .reduce((s, l) => s + l.weightG, 0)
  const sumPOthers = others
    .filter(l => roles.get(l.key)!.kind === 'P')
    .reduce((s, l) => s + (roles.get(l.key)!.p! / 100) * B, 0)
  const freeOthers = others.filter(l => roles.get(l.key)!.kind === 'F')

  let clamped = false
  let anchorWeight: number | null = null
  if (anchorLine && anchor) {
    // Room left for the anchor once every other lock has taken its share
    const room = Math.max(0, B - sumQOthers - sumPOthers)
    const wanted = anchor.kind === 'qty' ? anchor.value : (anchor.value / 100) * B
    // With nothing else free to absorb the change, the anchor must fill the batch exactly
    anchorWeight = freeOthers.length > 0 ? Math.min(wanted, room) : room
    clamped = Math.abs(anchorWeight - wanted) > EPS
  }

  const fixed: Record<string, number> = {}
  for (const l of others) {
    const role = roles.get(l.key)!
    if (role.kind === 'Q') fixed[l.key] = l.weightG
    if (role.kind === 'P') fixed[l.key] = (role.p! / 100) * B
  }
  if (anchorLine && anchorWeight != null) fixed[anchorLine.key] = anchorWeight
  const sumFixed = Object.values(fixed).reduce((s, w) => s + w, 0)
  const remaining = B - sumFixed

  if (freeOthers.length === 0) {
    if (Math.abs(remaining) > EPS) {
      return unchanged(
        remaining > 0
          ? `Locked values leave ${r4(remaining)} g of the ${r4(B)} g batch unassigned — leave at least one ingredient unlocked.`
          : `Locked values exceed the ${r4(B)} g batch by ${r4(-remaining)} g.`,
      )
    }
  } else if (remaining < -EPS) {
    return unchanged(`Locked values exceed the ${r4(B)} g batch by ${r4(-remaining)} g.`)
  }

  const out: Record<string, number> = { ...fixed }
  if (freeOthers.length > 0) {
    const sumF = freeOthers.reduce((s, l) => s + l.weightG, 0)
    for (const l of freeOthers) {
      out[l.key] = sumF > 1e-12 ? (l.weightG * remaining) / sumF : remaining / freeOthers.length
    }
  }
  for (const l of lines) weights[l.key] = r4(out[l.key] ?? l.weightG)

  // Rounding to 0.0001 g can leave the sum a hair off B: give the difference to the largest free line
  const flexible = freeOthers.length > 0 ? freeOthers : anchorLine ? [anchorLine] : []
  if (flexible.length > 0) {
    const diff = r4(B - lines.reduce((s, l) => s + weights[l.key], 0))
    if (diff !== 0) {
      const biggest = flexible.reduce((a, b) => (weights[b.key] > weights[a.key] ? b : a))
      weights[biggest.key] = r4(weights[biggest.key] + diff)
    }
  }
  return { weights, problem: null, clamped }
}
