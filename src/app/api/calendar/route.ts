import { NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { disconnect, getConnection, isGoogleCalendarConfigured } from '@/lib/calendar/google'

// The signed-in person's calendar connection: whether one can be made, and which Google account is connected
export async function GET() {
  const auth = await requireApi({ allowUnentitled: true })
  if (!auth.ok) return auth.res
  const configured = isGoogleCalendarConfigured()
  const row = configured ? await getConnection(auth.ctx.user.id) : null
  return NextResponse.json({
    configured,
    connection: row ? { provider: row.provider, email: row.externalEmail, connectedAt: row.createdAt } : null,
  })
}

export async function DELETE() {
  const auth = await requireApi({ allowUnentitled: true })
  if (!auth.ok) return auth.res
  await disconnect(auth.ctx.user.id)
  return NextResponse.json({ connection: null })
}
