import { describe, expect, it } from 'vitest'
import { billableSeats, formatSeatPrice, seatInterval, seatItemChanges } from './seats'
import { mapSubscription } from './subscription-map'

const MONTHLY = 'price_seat_month'
const YEARLY = 'price_seat_year'
const SEAT_IDS = [MONTHLY, YEARLY]

describe('seat pricing', () => {
  it('is $10/month or $100/year, following the plan interval', () => {
    expect(formatSeatPrice('month')).toBe('$10/month')
    expect(formatSeatPrice('year')).toBe('$100/year')
    expect(seatInterval('year')).toBe('year')
    expect(seatInterval('month')).toBe('month')
    expect(seatInterval(null)).toBe('month')
  })

  it('bills every member except the owner', () => {
    expect(billableSeats([{ role: 'owner' }])).toBe(0)
    expect(billableSeats([{ role: 'owner' }, { role: 'admin' }, { role: 'member' }])).toBe(2)
  })
})

describe('seatItemChanges', () => {
  const plan = { id: 'si_plan', quantity: 1, price: { id: 'price_plan' } }

  it('adds a seat item for the first member', () => {
    expect(seatItemChanges([plan], SEAT_IDS, MONTHLY, 1)).toEqual([{ price: MONTHLY, quantity: 1 }])
  })

  it('changes the quantity of an existing seat item', () => {
    const seat = { id: 'si_seat', quantity: 1, price: { id: MONTHLY } }
    expect(seatItemChanges([plan, seat], SEAT_IDS, MONTHLY, 3)).toEqual([{ id: 'si_seat', quantity: 3 }])
  })

  it('does nothing when already in sync', () => {
    const seat = { id: 'si_seat', quantity: 2, price: { id: MONTHLY } }
    expect(seatItemChanges([plan, seat], SEAT_IDS, MONTHLY, 2)).toEqual([])
    expect(seatItemChanges([plan], SEAT_IDS, MONTHLY, 0)).toEqual([])
  })

  it('removes the seat item when the last member leaves', () => {
    const seat = { id: 'si_seat', quantity: 1, price: { id: MONTHLY } }
    expect(seatItemChanges([plan, seat], SEAT_IDS, MONTHLY, 0)).toEqual([{ id: 'si_seat', deleted: true }])
  })

  it('replaces a seat item on the wrong interval', () => {
    const seat = { id: 'si_seat', quantity: 2, price: { id: MONTHLY } }
    expect(seatItemChanges([plan, seat], SEAT_IDS, YEARLY, 2)).toEqual([
      { id: 'si_seat', deleted: true },
      { price: YEARLY, quantity: 2 },
    ])
  })
})

describe('mapSubscription with a seat item', () => {
  it('reads the plan price from the plan item and the seat quantity from the seat item', () => {
    const m = mapSubscription(
      {
        id: 'sub_1',
        status: 'active',
        items: {
          data: [
            { current_period_end: 1_800_000_000, quantity: 3, price: { id: MONTHLY } },
            { current_period_end: 1_800_000_000, quantity: 1, price: { id: 'price_plan' } },
          ],
        },
      },
      SEAT_IDS,
    )
    expect(m.priceId).toBe('price_plan')
    expect(m.seatQuantity).toBe(3)
  })

  it('reports zero seats without a seat item', () => {
    expect(mapSubscription({ id: 'sub_2', status: 'active' }, SEAT_IDS).seatQuantity).toBe(0)
  })
})
