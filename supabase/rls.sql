-- Enable Row Level Security on all application tables.
-- All data access in Benchtop goes through Next.js API routes (Drizzle, postgres
-- superuser connection) so RLS does not affect the app itself. These policies
-- block direct PostgREST / Supabase-client access by anyone who is not
-- authenticated, and silence Supabase's "RLS Disabled in Public" warning.
--
-- Policy: authenticated Supabase users (any logged-in ALP Bio employee)
-- have full read/write access to every table. There is no row-level isolation
-- because this is a single-org internal tool.
--
-- HOW TO APPLY: paste the entire file into Supabase → SQL Editor → Run.

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

-- ── Reverse-engineering data ──────────────────────────────────────────────────

ALTER TABLE reverse_targets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE reverse_candidates     ENABLE ROW LEVEL SECURITY;

-- ── Audit ─────────────────────────────────────────────────────────────────────

ALTER TABLE audit_log              ENABLE ROW LEVEL SECURITY;

-- ── Policies: authenticated users have full access ────────────────────────────

CREATE POLICY "authenticated_all" ON nutrients            FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON ingredient_allergens FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON ingredient_certs     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON ingredient_docs      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON ingredient_nutrients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON ingredients          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON sub_ingredients      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON suppliers            FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON ingredient_suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON projects             FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON formulations         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON formulation_lines    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON formulation_targets  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON process_steps        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON reverse_targets      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON reverse_candidates   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON audit_log            FOR ALL TO authenticated USING (true) WITH CHECK (true);
