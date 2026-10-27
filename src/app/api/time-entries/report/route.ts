import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { getOwnedClient } from '@/lib/clients-server'
import { notFoundResponse } from '@/lib/tenancy'
import { isTeamAdmin } from '@/lib/team-access'
import { parseTimeFilter } from '@/lib/time-tracking'
import { loadTimeEntries } from '@/lib/time-entries-server'

// Everything the client-facing time report needs: the entries for one client matching the filters,
// who it's from, and who it's for. Client billing details only go to owners and admins, like the
// client records they come from.
export async function GET(req: NextRequest) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const filter = parseTimeFilter(req.nextUrl.searchParams)
  if (!filter.success || !filter.data.client) return NextResponse.json({ error: 'Choose a client' }, { status: 400 })

  const client = await getOwnedClient(ctx.account.id, filter.data.client)
  if (!client) return notFoundResponse('Client not found')

  const { entries, truncated } = await loadTimeEntries(ctx, filter.data)
  const admin = isTeamAdmin(ctx.role)

  return NextResponse.json({
    client: {
      id: client.id,
      name: client.name,
      legalName: client.legalName,
      billingAddress: admin ? client.billingAddress : null,
      billingEmail: admin ? client.billingEmail : null,
    },
    from: {
      company: ctx.profile?.company?.trim() || ctx.account.name,
      name: ctx.profile?.fullName?.trim() || null,
      email: ctx.user.email ?? null,
      phone: ctx.profile?.phone?.trim() || null,
    },
    // Running timers have nothing to bill yet
    entries: entries.filter(e => e.endedAt),
    truncated,
  })
}
