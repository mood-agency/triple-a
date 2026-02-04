-- Add is_all_day column to notes table
-- Distinguishes all-day tasks from tasks scheduled at midnight
ALTER TABLE notes ADD COLUMN is_all_day BOOLEAN NOT NULL DEFAULT false;

-- Backfill: existing notes with midnight deadlines are treated as all-day
UPDATE notes
SET is_all_day = true
WHERE deadline IS NOT NULL
  AND EXTRACT(HOUR FROM deadline) = 0
  AND EXTRACT(MINUTE FROM deadline) = 0
  AND EXTRACT(SECOND FROM deadline) = 0;
