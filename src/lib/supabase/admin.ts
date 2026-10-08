import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

// Service-role Supabase client. SERVER ONLY: it bypasses RLS and Storage policies, so it must
// only be used after an app-level ownership check, and the key must never get a NEXT_PUBLIC_ prefix.

export class AdminNotConfiguredError extends Error {
  constructor() {
    super('SUPABASE_SERVICE_ROLE_KEY (and NEXT_PUBLIC_SUPABASE_URL) must be set for this operation')
    this.name = 'AdminNotConfiguredError'
  }
}

export function isAdminConfigured(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL)
}

let cached: SupabaseClient | null = null

// Lazy: throws only when called with the key missing, never at import time (so `next build`
// works without it).
export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new AdminNotConfiguredError()
  if (!cached) {
    cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  }
  return cached
}

export const DOCS_BUCKET = 'ingredient-docs'

// Creates the private docs bucket if it doesn't exist yet (e.g. a fresh Supabase project).
// Safe to call repeatedly: an "already exists" result is treated as success.
export async function ensureDocsBucket(): Promise<{ message: string } | null> {
  const { error } = await getSupabaseAdmin().storage.createBucket(DOCS_BUCKET, { public: false })
  if (error && !/already exists|duplicate/i.test(error.message)) return error
  return null
}

// Best-effort lookup of an existing auth user by email. Tries the auth schema directly (works on
// a Supabase Postgres), then the admin API. Returns null when no user is found OR neither path is
// available; callers must still handle a duplicate-email error from createUser.
export async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const needle = email.trim().toLowerCase()
  try {
    const rows = await db.execute(sql`select id from auth.users where lower(email) = ${needle} limit 1`)
    const first = (rows as unknown as Array<{ id: string }>)[0]
    return first?.id ?? null
  } catch {
    // auth schema not reachable from this connection; fall through to the admin API
  }
  if (!isAdminConfigured()) return null
  try {
    const admin = getSupabaseAdmin()
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
      if (error) return null
      const hit = data.users.find(u => u.email?.toLowerCase() === needle)
      if (hit) return hit.id
      if (data.users.length < 1000) return null
    }
  } catch {
    return null
  }
  return null
}
