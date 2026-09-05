CREATE TABLE public.containers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text UNIQUE NOT NULL,
  type text NOT NULL CHECK (type IN ('album','box','loose_sheet','review_book')),
  description text,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.containers TO anon, authenticated;
GRANT ALL ON public.containers TO service_role;
ALTER TABLE public.containers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "containers_all_anon" ON public.containers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id uuid NOT NULL REFERENCES public.containers(id),
  label text UNIQUE NOT NULL,
  photo_path text,
  capture_type text CHECK (capture_type IN ('album_page','loose_grid')),
  captured_at timestamptz,
  identify_status text NOT NULL DEFAULT 'pending' CHECK (identify_status IN ('pending','running','done','failed')),
  raw_model_output jsonb,
  page_notes text,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pages TO anon, authenticated;
GRANT ALL ON public.pages TO service_role;
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pages_all_anon" ON public.pages FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.stamps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.pages(id),
  position_index integer,
  crop_path text,
  bbox jsonb,
  country text,
  country_inscription text,
  year_estimate integer,
  year_confidence numeric,
  denomination text,
  currency text,
  issue_name text,
  catalogue_system text,
  catalogue_number text,
  catalogue_confidence numeric,
  item_type text NOT NULL DEFAULT 'unknown' CHECK (item_type IN ('postage','revenue','cinderella','label','unknown')),
  mint_or_used text,
  hinged_guess text,
  gum_state text NOT NULL DEFAULT 'unknown' CHECK (gum_state IN ('never_hinged','hinged','no_gum','regummed','unknown')),
  format text NOT NULL DEFAULT 'single' CHECK (format IN ('single','block','sheet','on_cover','se_tenant')),
  faults text[],
  perforation text,
  watermark text,
  condition_notes text,
  set_name text,
  set_position text,
  quantity integer NOT NULL DEFAULT 1,
  value_low numeric,
  value_high numeric,
  value_source text,
  value_confidence numeric,
  confidence numeric,
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','auto_accepted','confirmed','flagged_expert','rejected')),
  notes text,
  tags text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stamps TO anon, authenticated;
GRANT ALL ON public.stamps TO service_role;
ALTER TABLE public.stamps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stamps_all_anon" ON public.stamps FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);