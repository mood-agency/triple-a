-- Migration: Drop deprecated assignee_id column from notes table
-- Description: Removes the legacy single assignee field now that we use note_assignees junction table
-- Date: 2026-01-28

-- Safety check: Ensure all existing assignee_id data has been migrated to note_assignees
-- This will raise an error if there are any notes with assignee_id that aren't in note_assignees
DO $$
DECLARE
  unmigrated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO unmigrated_count
  FROM notes n
  WHERE n.assignee_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM note_assignees na
    WHERE na.note_id = n.id AND na.contact_id = n.assignee_id
  );

  IF unmigrated_count > 0 THEN
    RAISE EXCEPTION 'Found % notes with assignee_id not migrated to note_assignees. Run the previous migration first.', unmigrated_count;
  END IF;
END $$;

-- Drop the assignee_id column
ALTER TABLE notes DROP COLUMN IF EXISTS assignee_id;

-- Add comment documenting the change
COMMENT ON TABLE notes IS 'Notes table. Assignees are now stored in note_assignees junction table (supports multiple assignees per note)';
