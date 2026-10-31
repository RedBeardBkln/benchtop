import { NextRequest, NextResponse } from 'next/server'
import { requireConnection } from '@/lib/invoicing-connection-server'
import { loadTimeOptions } from '@/lib/time-entries-server'

// Invoicing connection: the clients the connected person logs time against, to link them to the
// invoicing app's clients
export async function GET(req: NextRequest) {
  const auth = await requireConnection(req)
  if (!auth.ok) return auth.res
  const { clients } = await loadTimeOptions(auth.ctx)
  return NextResponse.json({ clients })
}
