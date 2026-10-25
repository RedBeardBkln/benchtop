import { NextRequest, NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { clientContacts, clients, projects } from '@/lib/db/schema'
import { and, asc, desc, eq } from 'drizzle-orm'
import { clientPatchSchema, normalizeClientFields } from '@/lib/client-schemas'
import { clientNameTakenResponse, getOwnedClient, isDuplicateNameError, propagateClientRename } from '@/lib/clients-server'
import { notFoundResponse } from '@/lib/tenancy'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi({ teamAdmin: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  const client = await getOwnedClient(ctx.account.id, id)
  if (!client) return notFoundResponse()

  const [contacts, linked] = await Promise.all([
    db.select().from(clientContacts).where(eq(clientContacts.clientId, id))
      .orderBy(asc(clientContacts.position), asc(clientContacts.createdAt)),
    db.select({ id: projects.id, name: projects.name, status: projects.status, updatedAt: projects.updatedAt })
      .from(projects)
      .where(and(eq(projects.accountId, ctx.account.id), eq(projects.clientId, id)))
      .orderBy(desc(projects.updatedAt)),
  ])

  return NextResponse.json({ ...client, contacts, projects: linked })
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireApi({ teamAdmin: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  const existing = await getOwnedClient(ctx.account.id, id)
  if (!existing) return notFoundResponse()

  const parsed = clientPatchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid client' }, { status: 400 })
  }
  const updates = normalizeClientFields(parsed.data)

  try {
    const row = await db.transaction(async tx => {
      const [updated] = await tx
        .update(clients)
        .set({ ...updates, updatedAt: new Date() })
        .where(and(eq(clients.id, id), eq(clients.accountId, ctx.account.id)))
        .returning()
      if (updates.name !== undefined) {
        await propagateClientRename(tx, ctx.account.id, id, existing.name, updated.name)
      }
      return updated
    })
    return NextResponse.json(row)
  } catch (err) {
    if (isDuplicateNameError(err)) {
      return clientNameTakenResponse(ctx.account.id, updates.name)
    }
    throw err
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApi({ teamAdmin: true })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const { id } = await params
  const client = await getOwnedClient(ctx.account.id, id)
  if (!client) return notFoundResponse()

  // Unlinking would silently change which team members can see those projects, so it's refused
  const [linked] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.accountId, ctx.account.id), eq(projects.clientId, id)))
    .limit(1)
  if (linked) {
    return NextResponse.json(
      { error: 'This client still has projects. Move them to another client first.' },
      { status: 409 },
    )
  }

  await db.delete(clients).where(and(eq(clients.id, id), eq(clients.accountId, ctx.account.id)))
  return new NextResponse(null, { status: 204 })
}
