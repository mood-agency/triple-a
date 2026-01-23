-- Migration: Add fixed_note_id column to user_preferences
-- Description: Add column to store which note is pinned/fixed in the sidebar
-- Date: 2026-01-22

-- Add fixed_note_id column if it doesn't exist (for existing installations)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_preferences'
    AND column_name = 'fixed_note_id'
  ) THEN
    ALTER TABLE public.user_preferences
    ADD COLUMN fixed_note_id TEXT DEFAULT NULL;

    COMMENT ON COLUMN public.user_preferences.fixed_note_id IS 'ID of the note that is fixed/pinned in the sidebar panel';
  END IF;
END $$;
