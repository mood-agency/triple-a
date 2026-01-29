-- Migration: Add user_id column to note_assignees
-- Description: Adds user_id column for proper sync filtering
-- Date: 2026-01-28

-- Add user_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'note_assignees' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE note_assignees ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Populate user_id from the related note's user_id for existing records
UPDATE note_assignees na
SET user_id = n.user_id
FROM notes n
WHERE na.note_id = n.id
AND na.user_id IS NULL;

-- Make user_id NOT NULL after populating
ALTER TABLE note_assignees ALTER COLUMN user_id SET NOT NULL;

-- Create index for efficient filtering by user_id
CREATE INDEX IF NOT EXISTS idx_note_assignees_user_id ON note_assignees(user_id);

-- Update RLS policies to also use user_id directly for simpler queries
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view assignees for their own notes" ON note_assignees;
DROP POLICY IF EXISTS "Users can insert assignees for their own notes" ON note_assignees;
DROP POLICY IF EXISTS "Users can delete assignees from their own notes" ON note_assignees;

-- Create simplified policies using direct user_id comparison
CREATE POLICY "Users can view their own note assignees"
  ON note_assignees
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own note assignees"
  ON note_assignees
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own note assignees"
  ON note_assignees
  FOR DELETE
  USING (user_id = auth.uid());

-- Add comment
COMMENT ON COLUMN note_assignees.user_id IS 'User who owns this note-assignee relationship (denormalized for efficient querying)';
