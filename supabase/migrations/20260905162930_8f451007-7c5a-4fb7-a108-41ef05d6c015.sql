ALTER TABLE public.stamps
  ADD COLUMN IF NOT EXISTS research_brief text,
  ADD COLUMN IF NOT EXISTS research_brief_generated_at timestamptz;

ALTER TABLE public.stamp_sets
  ADD COLUMN IF NOT EXISTS research_brief text,
  ADD COLUMN IF NOT EXISTS research_brief_generated_at timestamptz;

CREATE TABLE public.identify_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_ids uuid[] NOT NULL DEFAULT '{}',
  current_index integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','done','cancelled')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.identify_runs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.identify_runs TO authenticated;
GRANT ALL ON public.identify_runs TO service_role;

ALTER TABLE public.identify_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY identify_runs_all_anon ON public.identify_runs
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);