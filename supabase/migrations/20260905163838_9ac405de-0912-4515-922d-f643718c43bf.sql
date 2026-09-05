ALTER TABLE public.stamps
  ADD COLUMN IF NOT EXISTS value_estimated_at timestamptz,
  ADD COLUMN IF NOT EXISTS value_basis text;

ALTER TABLE public.stamp_sets
  ADD COLUMN IF NOT EXISTS value_estimated_at timestamptz,
  ADD COLUMN IF NOT EXISTS value_basis text;