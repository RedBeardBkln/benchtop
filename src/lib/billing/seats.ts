// Pure team-seat billing rules (no DB or Stripe imports, so they are unit-testable).
//
// The account owner is covered by the plan. Every other member (admin or member) is one extra
// seat, billed as a second item on the same Stripe subscription. Stripe requires all items on a
// subscription to share one interval, so the seat price follows the plan: $5/month on a monthly
// plan, $50/year on a yearly one.

export const SEAT_PRICE_USD = { month: 5, year: 50 } as const

export type SeatInterval = keyof typeof SEAT_PRICE_USD

export function seatInterval(interval: string | null | undefined): SeatInterval {
  return interval === 'year' ? 'year' : 'month'
}

export function formatSeatPrice(interval: SeatInterval): string {
  return `$${SEAT_PRICE_USD[interval]}/${interval}`
}

// Paid seats for a membership list: everyone except the owner
export function billableSeats(members: Array<{ role: string }>): number {
  return members.filter(m => m.role !== 'owner').length
}

export type SeatItemLike = { id: string; quantity?: number | null; price: { id: string } }

export type SeatItemChange =
  | { id: string; deleted: true }
  | { id: string; quantity: number }
  | { price: string; quantity: number }

// The item changes that bring a subscription to `desired` seats at `seatPriceId`, or [] when it is
// already there. A seat item on the wrong price (the plan changed interval) is replaced.
export function seatItemChanges(
  items: SeatItemLike[],
  seatPriceIds: readonly string[],
  seatPriceId: string,
  desired: number,
): SeatItemChange[] {
  const seatItems = items.filter(i => seatPriceIds.includes(i.price.id))
  const current = seatItems.find(i => i.price.id === seatPriceId)
  const changes: SeatItemChange[] = seatItems
    .filter(i => i !== current)
    .map(i => ({ id: i.id, deleted: true as const }))

  if (desired <= 0) {
    if (current) changes.push({ id: current.id, deleted: true })
  } else if (current) {
    if ((current.quantity ?? 0) !== desired) changes.push({ id: current.id, quantity: desired })
  } else {
    changes.push({ price: seatPriceId, quantity: desired })
  }
  return changes
}
