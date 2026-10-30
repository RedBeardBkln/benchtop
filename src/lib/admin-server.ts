import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { getAuthEmails } from '@/lib/supabase/admin'
import type { AccountUsage } from '@/lib/admin-actions'

// Server helpers for the platform admin console (DB access, every account). Callers must have
// checked requireApi({ platformAdmin: true }).

export type AuthUserInfo = { id: string; email: string | null; createdAt: string | null; lastSignInAt: string | null }

// Logins from Supabase auth: every one, or the given ids. Falls back to emails only when the auth
// schema isn't reachable from this connection.
export async function getAuthUsers(ids?: string[]): Promise<Map<string, AuthUserInfo>> {
  const out = new Map<string, AuthUserInfo>()
  if (ids && ids.length === 0) return out
  try {
    const where = ids ? sql`where id in (${sql.join(ids.map(id => sql`${id}::uuid`), sql`, `)})` : sql``
    const rows = await db.execute(sql`select id, email, created_at, last_sign_in_at from auth.users ${where}`)
    for (const r of rows as unknown as Array<{ id: string; email: string | null; created_at: Date | null; last_sign_in_at: Date | null }>) {
      out.set(r.id, {
        id: r.id,
        email: r.email,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
        lastSignInAt: r.last_sign_in_at ? new Date(r.last_sign_in_at).toISOString() : null,
      })
    }
    return out
  } catch {
    if (!ids) return out
  }
  const emails = await getAuthEmails(ids)
  for (const id of ids) out.set(id, { id, email: emails.get(id) ?? null, createdAt: null, lastSignInAt: null })
  return out
}


const n = (v: unknown) => Number(v ?? 0)

// Usage counts for every live account, or one
export async function getAccountUsage(accountId?: string): Promise<Map<string, AccountUsage>> {
  const where = accountId ? sql`and a.id = ${accountId}::uuid` : sql``
  const rows = await db.execute(sql`
    select a.id,
      (select count(*) from account_members x where x.account_id = a.id) as members,
      (select count(*) from projects x where x.account_id = a.id) as projects,
      (select count(*) from formulations x where x.account_id = a.id) as formulations,
      (select count(*) from ingredients x where x.account_id = a.id) as ingredients,
      (select count(*) from suppliers x where x.account_id = a.id) as suppliers,
      (select count(*) from clients x where x.account_id = a.id) as clients,
      (select count(*) from time_entries x where x.account_id = a.id) as time_entries,
      (select count(*) from sous_chef_conversations x where x.account_id = a.id) as sous_chef_conversations,
      (select count(*) from sous_chef_messages m join sous_chef_conversations c on c.id = m.conversation_id
        where c.account_id = a.id and m.role = 'user' and m.created_at > now() - interval '30 days') as sous_chef_messages_30d,
      (select count(*) from ingredient_docs d join ingredients i on i.id = d.ingredient_id where i.account_id = a.id) as documents,
      (select count(*) from activity_log x where x.account_id = a.id and x.at > now() - interval '30 days') as changes_30d,
      (select count(*) from activity_log x where x.account_id = a.id and x.at > now() - interval '7 days') as changes_7d,
      (select max(p.last_seen_at) from profiles p join account_members m on m.user_id = p.user_id where m.account_id = a.id) as last_seen_at
    from accounts a
    where a.deleted_at is null ${where}
  `)
  const out = new Map<string, AccountUsage>()
  for (const r of rows as unknown as Array<Record<string, unknown>>) {
    out.set(String(r.id), {
      members: n(r.members),
      projects: n(r.projects),
      formulations: n(r.formulations),
      ingredients: n(r.ingredients),
      suppliers: n(r.suppliers),
      clients: n(r.clients),
      timeEntries: n(r.time_entries),
      sousChefConversations: n(r.sous_chef_conversations),
      sousChefMessages30d: n(r.sous_chef_messages_30d),
      documents: n(r.documents),
      changes30d: n(r.changes_30d),
      changes7d: n(r.changes_7d),
      lastSeenAt: r.last_seen_at ? new Date(r.last_seen_at as string).toISOString() : null,
    })
  }
  return out
}
