-- Add public sharing columns to notes table
ALTER TABLE notes ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE notes ADD COLUMN public_slug TEXT UNIQUE;

-- Create index for public slug lookup (used by public viewer)
CREATE UNIQUE INDEX idx_notes_public_slug ON notes(public_slug) WHERE public_slug IS NOT NULL;

-- RLS policy: Allow anyone to read public notes
-- This policy is OR-ed with the existing "Users can view own notes" policy
CREATE POLICY "Anyone can view public notes"
  ON notes FOR SELECT
  USING (is_public = true AND deleted_at IS NULL);
