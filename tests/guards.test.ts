import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// Cheap static guards against the main risk of the multi-tenant change: a route, page or query that
// forgets the gate or the account filter. They are heuristics (file-level, not per-statement), so
// they complement, and do not replace, reading the diff and the two-account manual probe.

const ROOT = path.resolve(__dirname, '..')
const rel = (p: string) => path.relative(ROOT, p).split(path.sep).join('/')
const read = (p: string) => fs.readFileSync(p, 'utf8')

function walk(dir: string, filter: (file: string) => boolean, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue
      walk(full, filter, out)
    } else if (filter(full)) out.push(full)
  }
  return out
}

describe('every API route is gated', () => {
  // Public on purpose: the webhook authenticates by Stripe signature, redeem by invite token,
  // auth/confirm is Supabase's email-link callback (not under /api).
  const PUBLIC_ROUTES = new Set(['src/app/api/stripe/webhook/route.ts', 'src/app/api/invitations/redeem/route.ts'])
  const routes = walk(path.join(ROOT, 'src/app/api'), f => f.endsWith('route.ts')).map(rel)

  it('finds the routes', () => {
    expect(routes.length).toBeGreaterThan(40)
  })

  it.each(routes)('%s uses requireApi (or is an explicit public route)', file => {
    const src = read(path.join(ROOT, file))
    if (PUBLIC_ROUTES.has(file)) {
      expect(src).not.toMatch(/requireApi\(/)
      return
    }
    expect(src).toMatch(/requireApi\(/)
    // The old per-route auth preamble must be gone: it authenticates but never scopes
    expect(src).not.toMatch(/@\/lib\/supabase\/server/)
  })

  it('public routes are also open in the middleware allowlist', () => {
    const mw = read(path.join(ROOT, 'src/middleware.ts'))
    expect(mw).toContain('/api/stripe/webhook')
    expect(mw).toContain('/api/invitations/redeem')
    expect(mw).toContain('/invite')
    expect(mw).toContain('/legal')
  })
})

describe('every app page is gated', () => {
  const PUBLIC_PAGES = new Set([
    'src/app/login/page.tsx',
    'src/app/forgot-password/page.tsx',
    'src/app/reset-password/page.tsx',
    'src/app/invite/[token]/page.tsx',
    'src/app/legal/terms/page.tsx',
    'src/app/legal/privacy/page.tsx',
    'src/app/no-account/page.tsx', // uses getContext() itself; shown only to account-less users
    'src/app/settings/page.tsx', // redirect-only; the settings layout is gated
  ])
  const pages = walk(path.join(ROOT, 'src/app'), f => f.endsWith('page.tsx')).map(rel)

  it.each(pages)('%s calls requirePage (or is an explicit public page)', file => {
    if (PUBLIC_PAGES.has(file)) return
    expect(read(path.join(ROOT, file))).toMatch(/requirePage\(/)
  })

  it('settings layout and admin page are gated', () => {
    expect(read(path.join(ROOT, 'src/app/settings/layout.tsx'))).toMatch(/requirePage\(/)
    expect(read(path.join(ROOT, 'src/app/admin/invitations/page.tsx'))).toMatch(/platformAdmin:\s*true/)
  })
})

describe('tenant tables are always scoped', () => {
  // Root tables that carry account_id. Files that query them must reference accountId or an
  // ownership helper. (nutrients is a shared reference table and is intentionally absent.)
  const TENANT_QUERY = /\.(from|insert|update|delete|innerJoin|leftJoin)\(\s*(projects|formulations|ingredients|suppliers|equipment)\b/
  const SCOPED = /accountId|getOwned(Project|Formulation|Ingredient|Supplier|Equipment)|assert(Ingredients|Suppliers|Equipment)Owned/

  const files = [
    ...walk(path.join(ROOT, 'src/app'), f => /\.(ts|tsx)$/.test(f)),
    ...walk(path.join(ROOT, 'src/lib'), f => /\.ts$/.test(f) && !f.includes(`${path.sep}db${path.sep}`) && !f.endsWith('.test.ts')),
  ].map(rel)

  it('scans a meaningful number of files', () => {
    expect(files.length).toBeGreaterThan(60)
  })

  it('every file that queries a tenant table references the account scope', () => {
    const offenders = files.filter(f => {
      const src = read(path.join(ROOT, f))
      return TENANT_QUERY.test(src) && !SCOPED.test(src)
    })
    expect(offenders).toEqual([])
  })

  it('account_id has no default in the schema (a forgotten route must fail loudly)', () => {
    for (const f of ['projects', 'formulations', 'ingredients', 'suppliers', 'equipment', 'audit']) {
      const src = read(path.join(ROOT, `src/lib/db/schema/${f}.ts`))
      const line = src.split('\n').find(l => l.includes("uuid('account_id')"))
      expect(line, `${f}.ts has account_id`).toBeDefined()
      expect(line).toContain('.notNull()')
      expect(line).not.toMatch(/default/i)
    }
  })
})

describe('secrets never reach the client', () => {
  it('the service-role key is not NEXT_PUBLIC_', () => {
    const all = walk(ROOT, f => /\.(ts|tsx|md|example)$/.test(f) || f.endsWith('.env.example')).filter(
      f => !f.includes('node_modules') && !f.includes(`${path.sep}.next${path.sep}`) && !f.includes(`${path.sep}.claude${path.sep}`),
    )
    for (const f of all) {
      expect(read(f), rel(f)).not.toMatch(/NEXT_PUBLIC_[A-Z_]*(SERVICE_ROLE|STRIPE_SECRET)/)
    }
  })

  it('no client component touches the service-role client or key', () => {
    const files = walk(path.join(ROOT, 'src'), f => /\.(ts|tsx)$/.test(f))
    for (const f of files) {
      const src = read(f)
      if (!/^\s*['"]use client['"]/.test(src)) continue
      expect(src, rel(f)).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|supabase\/admin|billing\/stripe['"]|STRIPE_SECRET_KEY/)
    }
  })
})

describe('environment documentation', () => {
  it('every env var read by the code is listed in .env.example', () => {
    const example = read(path.join(ROOT, '.env.example'))
    const documented = new Set([...example.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map(m => m[1]))
    const sources = [
      ...walk(path.join(ROOT, 'src'), f => /\.(ts|tsx)$/.test(f) && !f.endsWith('.test.ts')),
      ...walk(path.join(ROOT, 'scripts'), f => f.endsWith('.ts')),
      path.join(ROOT, 'drizzle.config.ts'),
    ]
    const used = new Set<string>()
    for (const f of sources) {
      for (const m of read(f).matchAll(/(?:process\.env|\benv)\.([A-Z][A-Z0-9_]+)/g)) used.add(m[1])
    }
    used.delete('NODE_ENV') // set by Next/Node
    const missing = [...used].filter(v => !documented.has(v))
    expect(missing).toEqual([])
    // The Stripe / bypass vars from the plan must be there even if only read via an env param
    for (const v of ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_ID', 'STRIPE_WEBHOOK_SECRET', 'BILLING_DEV_BYPASS',
      'SUPABASE_SERVICE_ROLE_KEY', 'PLATFORM_ADMIN_EMAILS', 'NEXT_PUBLIC_APP_URL']) {
      expect(documented.has(v), v).toBe(true)
    }
  })

  it('README documents every variable in .env.example', () => {
    const readme = read(path.join(ROOT, 'README.md'))
    const example = read(path.join(ROOT, '.env.example'))
    for (const m of example.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)) {
      if (m[1] === 'DATABASE_URL' || m[1] === 'DIRECT_URL') continue // documented under both names
      expect(readme, m[1]).toContain(m[1])
    }
  })
})

describe('drizzle migration 0007 backfills before NOT NULL', () => {
  const dir = path.join(ROOT, 'drizzle')
  const file = fs.readdirSync(dir).find(f => f.startsWith('0007_') && f.endsWith('.sql'))!
  const sql = read(path.join(dir, file))
  const TABLES = ['ingredients', 'suppliers', 'equipment', 'projects', 'formulations', 'audit_log']

  it('exists', () => expect(file).toBeDefined())

  it('creates the legacy account with the fixed id before backfilling', () => {
    expect(sql).toContain('00000000-0000-4000-8000-000000000001')
    expect(sql.indexOf('INSERT INTO "accounts"')).toBeGreaterThan(-1)
    expect(sql.indexOf('INSERT INTO "accounts"')).toBeLessThan(sql.indexOf('UPDATE "ingredients"'))
  })

  it.each(TABLES)('%s: nullable add -> backfill -> SET NOT NULL, in that order, no default', table => {
    const add = sql.indexOf(`ALTER TABLE "${table}" ADD COLUMN "account_id" uuid;`)
    const upd = sql.indexOf(`UPDATE "${table}" SET "account_id"`)
    const nn = sql.indexOf(`ALTER TABLE "${table}" ALTER COLUMN "account_id" SET NOT NULL`)
    expect(add).toBeGreaterThan(-1)
    expect(upd).toBeGreaterThan(add)
    expect(nn).toBeGreaterThan(upd)
  })

  it('never adds account_id as NOT NULL in one step (would fail on populated tables)', () => {
    expect(sql).not.toMatch(/ADD COLUMN "account_id" uuid NOT NULL/)
    expect(sql).not.toMatch(/"account_id" uuid DEFAULT/)
  })

  it('swaps the global equipment name index for a per-account one', () => {
    expect(sql).toContain('DROP INDEX "equipment_name_lower_uq"')
    expect(sql).toContain('CREATE UNIQUE INDEX "equipment_account_name_lower_uq"')
  })

  it('has no comment-only statements between breakpoints', () => {
    for (const chunk of sql.split('--> statement-breakpoint')) {
      const body = chunk.split('\n').filter(l => l.trim() && !l.trim().startsWith('--'))
      expect(body.length, `chunk: ${chunk.slice(0, 60)}`).toBeGreaterThan(0)
    }
  })
})

describe('supabase hardening SQL', () => {
  const sqlFiles = ['supabase/migrations/004_outside_users_rls.sql', 'supabase/rls.sql']
  const TABLES = [
    'nutrients', 'ingredient_allergens', 'ingredient_certs', 'ingredient_docs', 'ingredient_nutrients',
    'ingredients', 'sub_ingredients', 'suppliers', 'ingredient_suppliers', 'projects', 'formulations',
    'formulation_lines', 'formulation_targets', 'process_steps', 'equipment', 'reverse_targets',
    'reverse_candidates', 'audit_log', 'batch_runs',
    'accounts', 'account_members', 'profiles', 'invitations', 'subscriptions', 'stripe_events',
  ]

  it.each(sqlFiles)('%s drops the permissive policies, enables RLS everywhere, creates no policy', file => {
    const sql = read(path.join(ROOT, file))
    expect(sql).not.toMatch(/^\s*CREATE POLICY/im)
    for (const t of TABLES) {
      expect(sql, `${file} enables RLS on ${t}`).toMatch(new RegExp(`ALTER TABLE\\s+${t}\\s+ENABLE ROW LEVEL SECURITY`))
    }
    for (const t of TABLES.slice(0, 19)) {
      expect(sql, `${file} drops authenticated_all on ${t}`).toMatch(
        new RegExp(`DROP POLICY IF EXISTS "authenticated_all" ON ${t};`),
      )
    }
  })
})
