-- Add deleted_reason column to notes table
-- This stores the reason why a note was deleted (when deleted via trash button)

ALTER TABLE notes
ADD COLUMN IF NOT EXISTS deleted_reason TEXT;

-- Add comment for documentation
COMMENT ON COLUMN notes.deleted_reason IS 'Optional reason for why the note was deleted';
