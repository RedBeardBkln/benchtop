import { NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { syncSeats } from '@/lib/billing/seat-sync'

// Re-syncs the billed seat count with the current members (e.g. after a Stripe error)
export async function POST() {
  const auth = await requireApi({ allowUnentitled: true, teamAdmin: true })
  if (!auth.ok) return auth.res

  const result = await syncSeats(auth.ctx.account.id)
  if (!result.ok) return NextResponse.json({ error: result.error, seats: result.seats }, { status: 502 })
  return NextResponse.json(result)
}
