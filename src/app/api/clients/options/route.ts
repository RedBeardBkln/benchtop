import { NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { clients } from '@/lib/db/schema'
import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { canCreateProject, isTeamAdmin } from '@/lib/team-access'

// Client names for the project dropdown (archived clients left out): every client for owners and admins; for members, only the
// clients they can create or move projects under. No accounting or shipping details here.
export async function GET() {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const rows = await db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(and(eq(clients.accountId, ctx.account.id), isNull(clients.archivedAt)))
    .orderBy(asc(sql`lower(${clients.name})`))

  return NextResponse.json({
    clients: rows.filter(c => canCreateProject(ctx.access, c.name)),
    canManage: isTeamAdmin(ctx.role),
    // Whether a project may be left without a client
    canChooseNone: canCreateProject(ctx.access, null),
  })
}
