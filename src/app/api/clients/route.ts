import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { accountMembers, clientContacts, clients, projects } from '@/lib/db/schema'
import { asc, eq, sql } from 'drizzle-orm'
import { clientFieldsSchema, normalizeClientFields } from '@/lib/client-schemas'
import { clientNameTakenResponse, forbiddenClientsResponse, isDuplicateNameError } from '@/lib/clients-server'
import { canAddClients, grantForNewClient } from '@/lib/team-access'
import { visibleProjectIds } from '@/lib/tenancy'

// Everyone on the account can see client records. What members may change is set per member by
// an admin (MemberAccess.clientRecords); owners and admins manage them all.

export async function GET() {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const [rows, counts, primaries, visible] = await Promise.all([
    db.select().from(clients).where(eq(clients.accountId, ctx.account.id)).orderBy(asc(sql`lower(${clients.name})`)),
    db
      .select({ id: projects.id, clientId: projects.clientId })
      .from(projects)
      .where(eq(projects.accountId, ctx.account.id)),
    db
      .select({ clientId: clientContacts.clientId, name: clientContacts.name, email: clientContacts.email, isPrimary: clientContacts.isPrimary })
      .from(clientContacts)
      .innerJoin(clients, eq(clientContacts.clientId, clients.id))
      .where(eq(clients.accountId, ctx.account.id))
      .orderBy(asc(clientContacts.position), asc(clientContacts.createdAt)),
    visibleProjectIds(ctx),
  ])

  // Members count only the projects they can see
  const countBy = new Map<string | null, number>()
  for (const p of counts) {
    if (!visible || visible.has(p.id)) countBy.set(p.clientId, (countBy.get(p.clientId) ?? 0) + 1)
  }
  // The primary contact, or the first one listed
  const contactBy = new Map<string, { name: string; email: string | null }>()
  for (const c of primaries) {
    if (c.isPrimary || !contactBy.has(c.clientId)) contactBy.set(c.clientId, { name: c.name, email: c.email })
  }

  return NextResponse.json({
    clients: rows.map(r => ({
      id: r.id,
      name: r.name,
      website: r.website,
      archivedAt: r.archivedAt,
      projectCount: countBy.get(r.id) ?? 0,
      primaryContact: contactBy.get(r.id) ?? null,
    })),
    canAdd: canAddClients(ctx.access),
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth
  if (!canAddClients(ctx.access)) return forbiddenClientsResponse('You can’t add clients. Ask an account admin.')

  const parsed = clientFieldsSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid client' }, { status: 400 })
  }

  try {
    const row = await db.transaction(async tx => {
      const [created] = await tx
        .insert(clients)
        .values({ ...normalizeClientFields(parsed.data), accountId: ctx.account.id, createdBy: ctx.user.id })
        .returning()
      // So the member who added it can put projects under it
      const access = grantForNewClient(ctx.access, created.name)
      if (access) await tx.update(accountMembers).set({ access }).where(eq(accountMembers.userId, ctx.user.id))
      return created
    })
    return NextResponse.json(row, { status: 201 })
  } catch (err) {
    if (isDuplicateNameError(err)) {
      return clientNameTakenResponse(ctx.account.id, parsed.data.name)
    }
    throw err
  }
}
