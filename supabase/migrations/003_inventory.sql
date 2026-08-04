-- Migration: inventory tracking + batch runs
-- Run in: benchtop Supabase SQL editor (project tegkbxjemnupfjcvsivu)

-- 1. Add stock_g to ingredients
ALTER TABLE ingredients
  ADD COLUMN IF NOT EXISTS stock_g NUMERIC(14, 4);

-- 2. Create batch_runs table
CREATE TABLE IF NOT EXISTS batch_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formulation_id  UUID NOT NULL REFERENCES formulations(id) ON DELETE CASCADE,
  batch_multiplier NUMERIC(10, 4) NOT NULL DEFAULT 1,
  notes           TEXT,
  run_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS batch_runs_formulation_idx ON batch_runs(formulation_id);

-- 3. Enable RLS (deny-by-default for PostgREST; Drizzle uses superuser and is unaffected)
ALTER TABLE batch_runs ENABLE ROW LEVEL SECURITY;
