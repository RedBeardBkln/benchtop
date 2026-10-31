import { NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { canUseInvoicingConnection } from '@/lib/invoicing-connection'
import { connectionStatus, createConnectionKey, revokeConnectionKey } from '@/lib/invoicing-connection-server'
import { notFoundResponse } from '@/lib/tenancy'

// The caller's invoicing connection key: status, make a new one (shown once), revoke.
// Only for the logins on the allow-list; everyone else gets a 404.

async function auth() {
  const result = await requireApi()
  if (!result.ok) return result
  if (!canUseInvoicingConnection(result.ctx.user.email)) return { ok: false as const, res: notFoundResponse() }
  return result
}

export async function GET() {
  const a = await auth()
  if (!a.ok) return a.res
  return NextResponse.json({ connection: await connectionStatus(a.ctx) })
}

export async function POST() {
  const a = await auth()
  if (!a.ok) return a.res
  const key = await createConnectionKey(a.ctx)
  return NextResponse.json({ key, connection: await connectionStatus(a.ctx) })
}

export async function DELETE() {
  const a = await auth()
  if (!a.ok) return a.res
  await revokeConnectionKey(a.ctx)
  return NextResponse.json({ connection: null })
}
