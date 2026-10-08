-- Migration 004: close the PostgREST / anon-key hole before outside users exist.
-- Run in: benchtop Supabase SQL editor. Idempotent (safe to re-run).
--
-- WHY: supabase/rls.sql used to grant EVERY authenticated Supabase user full read/write on EVERY
-- table ("authenticated_all"). With outside (paying) users holding authenticated sessions, anyone
-- could use the public anon key plus their own JWT to read or write every account's data through
-- PostgREST (/rest/v1/...), bypassing the app's account scoping entirely.
--
-- AFTER this migration: RLS is ON for every table and there are NO policies, which means the
-- `anon` and `authenticated` roles are denied everything. The app is unaffected because it talks
-- to Postgres through Drizzle with a privileged connection (which bypasses RLS) and uses the
-- service-role key for Storage and admin operations.
--
-- DEPLOY ORDER (see README): 1) drizzle migration 0007  2) this file  3) deploy code
--                            4) pnpm db:bootstrap (dry run), then with --apply

-- ── 1. Drop the permissive policies ──────────────────────────────────────────

DROP POLICY IF EXISTS "authenticated_all" ON nutrients;
DROP POLICY IF EXISTS "authenticated_all" ON ingredient_allergens;
DROP POLICY IF EXISTS "authenticated_all" ON ingredient_certs;
DROP POLICY IF EXISTS "authenticated_all" ON ingredient_docs;
DROP POLICY IF EXISTS "authenticated_all" ON ingredient_nutrients;
DROP POLICY IF EXISTS "authenticated_all" ON ingredients;
DROP POLICY IF EXISTS "authenticated_all" ON sub_ingredients;
DROP POLICY IF EXISTS "authenticated_all" ON suppliers;
DROP POLICY IF EXISTS "authenticated_all" ON ingredient_suppliers;
DROP POLICY IF EXISTS "authenticated_all" ON projects;
DROP POLICY IF EXISTS "authenticated_all" ON formulations;
DROP POLICY IF EXISTS "authenticated_all" ON formulation_lines;
DROP POLICY IF EXISTS "authenticated_all" ON formulation_targets;
DROP POLICY IF EXISTS "authenticated_all" ON process_steps;
DROP POLICY IF EXISTS "authenticated_all" ON equipment;
DROP POLICY IF EXISTS "authenticated_all" ON reverse_targets;
DROP POLICY IF EXISTS "authenticated_all" ON reverse_candidates;
DROP POLICY IF EXISTS "authenticated_all" ON audit_log;
DROP POLICY IF EXISTS "authenticated_all" ON batch_runs;

-- ── 2. RLS on every table (existing + new), with no policies = deny for anon/authenticated ──

ALTER TABLE nutrients              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_allergens   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_certs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_docs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_nutrients   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_ingredients        ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_suppliers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects               ENABLE ROW LEVEL SECURITY;
ALTER TABLE formulations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE formulation_lines      ENABLE ROW LEVEL SECURITY;
ALTER TABLE formulation_targets    ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_steps          ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment              ENABLE ROW LEVEL SECURITY;
ALTER TABLE reverse_targets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE reverse_candidates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log              ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_runs             ENABLE ROW LEVEL SECURITY;

-- New in migration 0007 (outside users / billing)
ALTER TABLE accounts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_events          ENABLE ROW LEVEL SECURITY;

-- ── 3. Verify (run these SELECTs; both should return zero rows) ──────────────
--
-- Tables in `public` WITHOUT row level security:
--   SELECT tablename FROM pg_tables
--   WHERE schemaname = 'public' AND NOT rowsecurity AND tablename NOT LIKE '\_\_drizzle%';
--
-- Any policy still granting access to anon/authenticated on public tables:
--   SELECT tablename, policyname, roles FROM pg_policies WHERE schemaname = 'public';

-- ── 4. Optional belt-and-braces (uncomment if you want it) ───────────────────
-- Remove table privileges from the API roles entirely, in addition to RLS:
--   REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;

-- ── 5. Storage bucket `ingredient-docs` — CHECK IN THE DASHBOARD (cannot be done safely here) ──
-- The repo never contained the bucket policies, so their current state is unknown. The app now
-- reads/writes this bucket ONLY with the service-role key, after an account-ownership check.
--   [ ] Storage -> Buckets -> ingredient-docs is PRIVATE (not "public bucket").
--   [ ] No policy on storage.objects lets `authenticated` or `anon` read/insert/update/delete
--       objects in this bucket. Review with:
--         SELECT policyname, cmd, roles, qual, with_check
--         FROM pg_policies
--         WHERE schemaname = 'storage' AND tablename = 'objects';
--       and drop any broad policy that names bucket_id = 'ingredient-docs' (or has no bucket filter).
--   [ ] Authentication -> Providers -> Email: "Allow new users to sign up" is DISABLED
--       (defense in depth; the app already denies any user without an account membership).
-- New uploads are stored as <account_id>/<ingredient_id>/<timestamp>-<name>. Existing objects keep
-- their old paths (the DB stores the path) and continue to work.
