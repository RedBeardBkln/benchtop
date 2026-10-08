-- Row Level Security for all application tables.
--
-- All data access in Benchtop goes through Next.js API routes (Drizzle, privileged postgres
-- connection, which bypasses RLS) and tenant isolation is enforced in the application layer by
-- account_id. RLS exists to make the database itself safe from direct PostgREST / Supabase-client
-- access with the public anon key.
--
-- Policy model: RLS is ENABLED on every table and there are intentionally NO policies. That means
-- the `anon` and `authenticated` roles are denied everything. (Earlier versions of this file granted
-- every authenticated user full access via an "authenticated_all" policy; that is unsafe now that
-- outside, paying users have authenticated sessions, and those policies are dropped below.)
--
-- HOW TO APPLY: paste the entire file into Supabase -> SQL Editor -> Run. Idempotent.
-- supabase/migrations/004_outside_users_rls.sql is the same change as a numbered migration, plus
-- the Storage-bucket checklist.

-- ── Drop the old permissive policies ──────────────────────────────────────────

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

-- ── Reference data ────────────────────────────────────────────────────────────

ALTER TABLE nutrients              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_allergens   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_certs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_docs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_nutrients   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_ingredients        ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_suppliers   ENABLE ROW LEVEL SECURITY;

-- ── Project / formulation data ────────────────────────────────────────────────

ALTER TABLE projects               ENABLE ROW LEVEL SECURITY;
ALTER TABLE formulations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE formulation_lines      ENABLE ROW LEVEL SECURITY;
ALTER TABLE formulation_targets    ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_steps          ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment              ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_runs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE formulation_nfp_panels ENABLE ROW LEVEL SECURITY;

-- ── Reverse-engineering data ──────────────────────────────────────────────────

ALTER TABLE reverse_targets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE reverse_candidates     ENABLE ROW LEVEL SECURITY;

-- ── Audit ─────────────────────────────────────────────────────────────────────

ALTER TABLE audit_log              ENABLE ROW LEVEL SECURITY;

-- ── Accounts, membership, profiles, invitations, billing (migration 0007) ─────

ALTER TABLE accounts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_events          ENABLE ROW LEVEL SECURITY;

-- ── Policies ──────────────────────────────────────────────────────────────────
-- None, on purpose. See the header.

-- ── Storage (checklist; do in the Supabase dashboard) ────────────────────────
--   [ ] Bucket `ingredient-docs` is private and has no broad `authenticated`/`anon` policy on
--       storage.objects (the app uses the service-role key for all document access).
--   [ ] Email sign-ups are disabled (Authentication -> Providers -> Email).
