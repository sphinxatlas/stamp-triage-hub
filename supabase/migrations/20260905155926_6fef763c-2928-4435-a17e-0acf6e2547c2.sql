CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.stamp_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
  set_name text NOT NULL,
  country text,
  year_from integer,
  year_to integer,
  catalogue_system text,
  catalogue_range text,
  item_count integer,
  confidence numeric,
  notes text,
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','auto_accepted','confirmed','flagged_expert','rejected')),
  priority_score integer NOT NULL DEFAULT 0,
  priority_reasons text[] NOT NULL DEFAULT '{}',
  significance text,
  significance_level text NOT NULL DEFAULT 'unknown' CHECK (significance_level IN ('key_issue','notable','ordinary','unknown')),
  forgery_risk text NOT NULL DEFAULT 'unknown' CHECK (forgery_risk IN ('high','medium','low','unknown')),
  variants_to_check text,
  market_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stamp_sets TO anon, authenticated;
GRANT ALL ON public.stamp_sets TO service_role;

ALTER TABLE public.stamp_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stamp_sets_all_anon" ON public.stamp_sets FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_stamp_sets_updated_at BEFORE UPDATE ON public.stamp_sets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.stamps
  ADD COLUMN set_id uuid REFERENCES public.stamp_sets(id) ON DELETE SET NULL,
  ADD COLUMN priority_score integer NOT NULL DEFAULT 0,
  ADD COLUMN priority_reasons text[] NOT NULL DEFAULT '{}',
  ADD COLUMN significance text,
  ADD COLUMN significance_level text NOT NULL DEFAULT 'unknown' CHECK (significance_level IN ('key_issue','notable','ordinary','unknown')),
  ADD COLUMN forgery_risk text NOT NULL DEFAULT 'unknown' CHECK (forgery_risk IN ('high','medium','low','unknown')),
  ADD COLUMN variants_to_check text,
  ADD COLUMN market_notes text;