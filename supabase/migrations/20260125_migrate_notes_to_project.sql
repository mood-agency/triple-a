-- Migration: Migrate all notes to a specific project
-- Description: Assigns all existing notes without a project to the specified project
-- Date: 2026-01-25

-- Update all notes that don't have a project assigned yet
UPDATE notes
SET
  project_id = '4e49d9d3-7d23-4138-8d42-c5cd669dc8ac',
  updated_at = NOW()
WHERE project_id IS NULL;

-- Verify the migration
-- SELECT COUNT(*) as total_notes,
--        COUNT(project_id) as notes_with_project
-- FROM notes;
