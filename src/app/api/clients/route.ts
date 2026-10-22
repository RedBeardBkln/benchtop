import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { clientContacts, clients, projects } from '@/lib/db/schema'
import { asc, eq, sql } from 'drizzle-orm'
import { clientFieldsSchema, normalizeClientFields } from '@/lib/client-schemas'
import { isDuplicateNameError } from '@/lib/clients-server'

// Client records hold accounting and shipping details, so only owners and admins manage them.
// Everyone else picks from /api/clients/options.

export async function GET() {
  const auth = await requireApi({ teamAdmin: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const [rows, counts, primaries] = await Promise.all([
    db.select().from(clients).where(eq(clients.accountId, ctx.account.id)).orderBy(asc(sql`lower(${clients.name})`)),
    db
      .select({ clientId: projects.clientId, count: sql<number>`count(*)::int` })
      .from(projects)
      .where(eq(projects.accountId, ctx.account.id))
      .groupBy(projects.clientId),
    db
      .select({ clientId: clientContacts.clientId, name: clientContacts.name, email: clientContacts.email, isPrimary: clientContacts.isPrimary })
      .from(clientContacts)
      .innerJoin(clients, eq(clientContacts.clientId, clients.id))
      .where(eq(clients.accountId, ctx.account.id))
      .orderBy(asc(clientContacts.position), asc(clientContacts.createdAt)),
  ])

  const countBy = new Map(counts.map(c => [c.clientId, c.count]))
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
      projectCount: countBy.get(r.id) ?? 0,
      primaryContact: contactBy.get(r.id) ?? null,
    })),
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireApi({ teamAdmin: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const parsed = clientFieldsSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid client' }, { status: 400 })
  }

  try {
    const [row] = await db
      .insert(clients)
      .values({ ...normalizeClientFields(parsed.data), accountId: ctx.account.id })
      .returning()
    return NextResponse.json(row, { status: 201 })
  } catch (err) {
    if (isDuplicateNameError(err)) {
      return NextResponse.json({ error: `A client named "${parsed.data.name}" already exists` }, { status: 409 })
    }
    throw err
  }
}
