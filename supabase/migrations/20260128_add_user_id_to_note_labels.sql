-- Migration: Add user_id column to note_labels
-- Description: Adds user_id column for proper sync filtering
-- Date: 2026-01-28

-- Add user_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'note_labels' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE note_labels ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Populate user_id from the related note's user_id for existing records
UPDATE note_labels nl
SET user_id = n.user_id
FROM notes n
WHERE nl.note_id = n.id
AND nl.user_id IS NULL;

-- Make user_id NOT NULL after populating (only if column exists and has data)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'note_labels' AND column_name = 'user_id'
  ) THEN
    -- Check if there are any NULL values first
    IF NOT EXISTS (SELECT 1 FROM note_labels WHERE user_id IS NULL) THEN
      ALTER TABLE note_labels ALTER COLUMN user_id SET NOT NULL;
    END IF;
  END IF;
END $$;

-- Create index for efficient filtering by user_id
CREATE INDEX IF NOT EXISTS idx_note_labels_user_id ON note_labels(user_id);

-- Update RLS policies if they exist
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Users can view labels for their own notes" ON note_labels;
  DROP POLICY IF EXISTS "Users can insert labels for their own notes" ON note_labels;
  DROP POLICY IF EXISTS "Users can delete labels from their own notes" ON note_labels;
  DROP POLICY IF EXISTS "Users can view their own note labels" ON note_labels;
  DROP POLICY IF EXISTS "Users can insert their own note labels" ON note_labels;
  DROP POLICY IF EXISTS "Users can delete their own note labels" ON note_labels;
EXCEPTION
  WHEN undefined_table THEN
    -- Table doesn't exist, nothing to do
    NULL;
END $$;

-- Create simplified policies using direct user_id comparison
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'note_labels') THEN
    -- Enable RLS if not already enabled
    ALTER TABLE note_labels ENABLE ROW LEVEL SECURITY;

    EXECUTE 'CREATE POLICY "Users can view their own note labels"
      ON note_labels
      FOR SELECT
      USING (user_id = auth.uid())';

    EXECUTE 'CREATE POLICY "Users can insert their own note labels"
      ON note_labels
      FOR INSERT
      WITH CHECK (user_id = auth.uid())';

    EXECUTE 'CREATE POLICY "Users can delete their own note labels"
      ON note_labels
      FOR DELETE
      USING (user_id = auth.uid())';
  END IF;
END $$;

-- Add comment
COMMENT ON COLUMN note_labels.user_id IS 'User who owns this note-label relationship (denormalized for efficient querying)';
