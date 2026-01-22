-- Migration: Change sort_order from INTEGER to NUMERIC to support decimal values
-- This is needed because the local app uses fractional sort_order values
-- when inserting notes between existing notes (e.g., 19.625)

ALTER TABLE public.notes
  ALTER COLUMN sort_order TYPE NUMERIC USING sort_order::numeric;

-- Set a default value
ALTER TABLE public.notes
  ALTER COLUMN sort_order SET DEFAULT 0;
