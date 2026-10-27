import { NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { loadTimeOptions } from '@/lib/time-entries-server'

// Clients and projects the caller can log time against, plus (owners and admins) the account's people
export async function GET() {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  return NextResponse.json(await loadTimeOptions(auth.ctx))
}
