ALTER TABLE public.stamp_sets
  ADD COLUMN IF NOT EXISTS value_low numeric,
  ADD COLUMN IF NOT EXISTS value_high numeric,
  ADD COLUMN IF NOT EXISTS value_source text,
  ADD COLUMN IF NOT EXISTS value_confidence numeric;