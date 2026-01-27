-- Migration: Create note_history table
-- Description: Stores historical changes to notes including postpone reasons, edits, and status changes
-- Date: 2026-01-27

-- Create note_history table if it doesn't exist
CREATE TABLE IF NOT EXISTS note_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action_type TEXT NOT NULL,
  reason TEXT,
  previous_date TIMESTAMPTZ
);

-- Add missing columns if they don't exist
-- Add created_at column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'note_history'
                 AND column_name = 'created_at') THEN
    ALTER TABLE note_history ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- Add sync_status column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'note_history'
                 AND column_name = 'sync_status') THEN
    ALTER TABLE note_history ADD COLUMN sync_status TEXT DEFAULT 'synced';
  END IF;
END $$;

-- Migrate old category values to new ones
UPDATE note_history SET category = 'todo' WHERE category NOT IN ('todo', 'idea', 'meeting', 'reminder');

-- Drop existing constraints if they exist
ALTER TABLE note_history DROP CONSTRAINT IF EXISTS note_history_category_check;
ALTER TABLE note_history DROP CONSTRAINT IF EXISTS note_history_action_type_check;
ALTER TABLE note_history DROP CONSTRAINT IF EXISTS note_history_sync_status_check;

-- Add constraints
ALTER TABLE note_history ADD CONSTRAINT note_history_category_check
  CHECK (category IN ('todo', 'idea', 'meeting', 'reminder'));
ALTER TABLE note_history ADD CONSTRAINT note_history_action_type_check
  CHECK (action_type IN ('created', 'edit', 'postponed', 'completed', 'uncompleted'));
ALTER TABLE note_history ADD CONSTRAINT note_history_sync_status_check
  CHECK (sync_status IN ('local', 'pending', 'synced', 'conflict'));

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_note_history_note_id ON note_history(note_id);
CREATE INDEX IF NOT EXISTS idx_note_history_user_id ON note_history(user_id);
CREATE INDEX IF NOT EXISTS idx_note_history_action_type ON note_history(note_id, action_type);
CREATE INDEX IF NOT EXISTS idx_note_history_changed_at ON note_history(note_id, changed_at DESC);

-- Enable RLS
ALTER TABLE note_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view own note history" ON note_history;
DROP POLICY IF EXISTS "Users can insert own note history" ON note_history;
DROP POLICY IF EXISTS "Users can update own note history" ON note_history;
DROP POLICY IF EXISTS "Users can delete own note history" ON note_history;

-- Policy: Users can view history for their own notes
CREATE POLICY "Users can view own note history"
  ON note_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert history for their own notes
CREATE POLICY "Users can insert own note history"
  ON note_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own note history
CREATE POLICY "Users can update own note history"
  ON note_history
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own note history
CREATE POLICY "Users can delete own note history"
  ON note_history
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add comments
COMMENT ON TABLE note_history IS 'Historical log of all changes made to notes';
COMMENT ON COLUMN note_history.note_id IS 'Reference to the note this history entry belongs to';
COMMENT ON COLUMN note_history.content IS 'Note content at the time of this change';
COMMENT ON COLUMN note_history.description IS 'Note description at the time of this change';
COMMENT ON COLUMN note_history.category IS 'Note category at the time of this change';
COMMENT ON COLUMN note_history.completed IS 'Note completion status at the time of this change';
COMMENT ON COLUMN note_history.changed_at IS 'When this change occurred';
COMMENT ON COLUMN note_history.action_type IS 'Type of change: created, edit, postponed, completed, uncompleted';
COMMENT ON COLUMN note_history.reason IS 'Optional reason for the change (e.g., postpone reason)';
COMMENT ON COLUMN note_history.previous_date IS 'Previous deadline before postponement (for postponed action_type)';
COMMENT ON COLUMN note_history.sync_status IS 'Sync status with local TinyBase store';
