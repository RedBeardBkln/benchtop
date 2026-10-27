import { NextResponse } from 'next/server'
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, sql, type SQL } from 'drizzle-orm'
import { db } from '@/lib/db'
import { accountMembers, clients, profiles, projects, timeEntries } from '@/lib/db/schema'
import type { AuthContext } from '@/lib/auth/context'
import { isUuid, notFoundResponse, visibleProjects } from '@/lib/tenancy'
import { isTeamAdmin, normalizeClient } from '@/lib/team-access'
import { MAX_ENTRIES, type TimeFilter } from '@/lib/time-tracking'

// Server side of time tracking (DB access). Everyone logs and sees their own time; owners and admins
// also see and change everyone's. Time can be logged against a client the caller has some access to:
// every client for owners and admins; for members, clients their project access covers.

export type TimeOptions = {
  clients: Array<{ id: string; name: string }>
  projects: Array<{ id: string; name: string; clientId: string }>
  /** Owners and admins: the account's people, for the Person filter */
  people: Array<{ userId: string; name: string }> | null
  me: string
}

/** Clients and projects the caller may log time against (archived ones left out) */
export async function loadTimeOptions(ctx: AuthContext): Promise<TimeOptions> {
  const [clientRows, projectRows] = await Promise.all([
    db
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(and(eq(clients.accountId, ctx.account.id), isNull(clients.archivedAt)))
      .orderBy(asc(sql`lower(${clients.name})`)),
    db
      .select({ id: projects.id, name: projects.name, client: projects.client, clientId: projects.clientId })
      .from(projects)
      .where(and(eq(projects.accountId, ctx.account.id), eq(projects.status, 'active'), isNotNull(projects.clientId)))
      .orderBy(asc(sql`lower(${projects.name})`)),
  ])

  const shownProjects = visibleProjects(ctx, projectRows)
  const access = ctx.access
  const withProject = new Set(shownProjects.map(p => p.clientId))
  const shownClients = !access ? clientRows : clientRows.filter(c =>
    access.allProjects !== 'none'
    || access.clients.some(g => normalizeClient(g.client) === normalizeClient(c.name))
    || withProject.has(c.id))
  const clientIds = new Set(shownClients.map(c => c.id))

  return {
    clients: shownClients,
    projects: shownProjects
      .filter(p => clientIds.has(p.clientId!))
      .map(p => ({ id: p.id, name: p.name, clientId: p.clientId! })),
    people: isTeamAdmin(ctx.role) ? await loadPeople(ctx.account.id) : null,
    me: ctx.user.id,
  }
}

/** The account's members by name; a missing name reads "Unnamed teammate" */
export async function loadPeople(accountId: string) {
  const rows = await db
    .select({ userId: accountMembers.userId, fullName: profiles.fullName })
    .from(accountMembers)
    .leftJoin(profiles, eq(profiles.userId, accountMembers.userId))
    .where(eq(accountMembers.accountId, accountId))
  return rows
    .map(r => ({ userId: r.userId, name: r.fullName?.trim() || 'Unnamed teammate' }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Checks that the client (and project, if any) are ones the caller may log time against, and that the
 * project belongs to that client. Returns an error response, or null when they're fine.
 */
export function checkClientAndProject(opts: TimeOptions, clientId: string, projectId: string | null) {
  if (!opts.clients.some(c => c.id === clientId)) {
    return NextResponse.json({ error: 'Choose one of your clients' }, { status: 400 })
  }
  if (projectId && !opts.projects.some(p => p.id === projectId && p.clientId === clientId)) {
    return NextResponse.json({ error: 'That project isn’t one of this client’s' }, { status: 400 })
  }
  return null
}

export type TimeEntryRow = {
  id: string
  userId: string
  userName: string
  clientId: string
  clientName: string
  projectId: string | null
  projectName: string | null
  activity: string
  task: string
  startedAt: string
  endedAt: string | null
  billed: boolean
  billedAt: string | null
  canEdit: boolean
}

/** The caller's view of the entries matching the filter, newest first (at most MAX_ENTRIES) */
export async function loadTimeEntries(ctx: AuthContext, filter: TimeFilter): Promise<{ entries: TimeEntryRow[]; truncated: boolean }> {
  const admin = isTeamAdmin(ctx.role)
  const where: SQL[] = [eq(timeEntries.accountId, ctx.account.id)]
  // Members only ever see their own time
  const user = !admin || !filter.user || filter.user === 'me' ? ctx.user.id : filter.user === 'all' ? null : filter.user
  if (user) where.push(eq(timeEntries.userId, user))
  if (filter.client) where.push(eq(timeEntries.clientId, filter.client))
  if (filter.project) where.push(eq(timeEntries.projectId, filter.project))
  if (filter.from) where.push(gte(timeEntries.startedAt, new Date(filter.from)))
  if (filter.to) where.push(lt(timeEntries.startedAt, new Date(filter.to)))
  if (filter.billed === 'billed') where.push(eq(timeEntries.billed, true))
  if (filter.billed === 'unbilled') where.push(eq(timeEntries.billed, false))
  if (filter.running) where.push(isNull(timeEntries.endedAt))

  const [rows, people] = await Promise.all([
    db
      .select({ e: timeEntries, clientName: clients.name, projectName: projects.name })
      .from(timeEntries)
      .innerJoin(clients, eq(timeEntries.clientId, clients.id))
      .leftJoin(projects, eq(timeEntries.projectId, projects.id))
      .where(and(...where))
      .orderBy(desc(timeEntries.startedAt))
      .limit(MAX_ENTRIES + 1),
    loadPeople(ctx.account.id),
  ])
  const nameBy = new Map(people.map(p => [p.userId, p.name]))

  return {
    truncated: rows.length > MAX_ENTRIES,
    entries: rows.slice(0, MAX_ENTRIES).map(({ e, clientName, projectName }) => ({
      id: e.id,
      userId: e.userId,
      // Someone no longer on the team keeps their entries
      userName: nameBy.get(e.userId) ?? 'Former teammate',
      clientId: e.clientId,
      clientName,
      projectId: e.projectId,
      projectName,
      activity: e.activity,
      task: e.task,
      startedAt: e.startedAt.toISOString(),
      endedAt: e.endedAt?.toISOString() ?? null,
      billed: e.billed,
      billedAt: e.billedAt?.toISOString() ?? null,
      canEdit: admin || e.userId === ctx.user.id,
    })),
  }
}

/** An entry the caller may change: their own, or anyone's for owners and admins. 404 otherwise. */
export async function loadEntryForEdit(ctx: AuthContext, id: string) {
  if (!isUuid(id)) return { ok: false as const, res: notFoundResponse() }
  const [row] = await db
    .select()
    .from(timeEntries)
    .where(and(eq(timeEntries.id, id), eq(timeEntries.accountId, ctx.account.id)))
    .limit(1)
  if (!row || (!isTeamAdmin(ctx.role) && row.userId !== ctx.user.id)) return { ok: false as const, res: notFoundResponse() }
  return { ok: true as const, entry: row }
}

/** Of these ids, the ones the caller may change */
export async function editableEntryIds(ctx: AuthContext, ids: string[]): Promise<string[]> {
  const where = [eq(timeEntries.accountId, ctx.account.id), inArray(timeEntries.id, ids)]
  if (!isTeamAdmin(ctx.role)) where.push(eq(timeEntries.userId, ctx.user.id))
  const rows = await db.select({ id: timeEntries.id }).from(timeEntries).where(and(...where))
  return rows.map(r => r.id)
}

/** Postgres unique violation on the one-running-timer-per-person index */
export function isRunningTimerConflict(err: unknown): boolean {
  const e = err as { code?: string; constraint_name?: string; cause?: { code?: string; constraint_name?: string } }
  const c = e.cause ?? e
  return c.code === '23505' && c.constraint_name === 'time_entries_one_running_uq'
}

export function runningTimerResponse() {
  return NextResponse.json(
    { error: 'You already have a timer running. Stop it before starting another.', code: 'timer_running' },
    { status: 409 },
  )
}
