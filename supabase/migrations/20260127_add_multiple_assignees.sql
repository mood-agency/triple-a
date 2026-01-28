-- Migration: Add multiple assignees support
-- Description: Creates note_assignees junction table for many-to-many relationship between notes and contacts
-- Date: 2026-01-27

-- Create note_assignees junction table if it doesn't exist
CREATE TABLE IF NOT EXISTS note_assignees (
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (note_id, contact_id)
);

-- Migrate existing single assignee data to junction table
-- Only insert if the note_assignees table is empty (for idempotency)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM note_assignees LIMIT 1) THEN
    INSERT INTO note_assignees (note_id, contact_id, created_at)
    SELECT id, assignee_id, NOW()
    FROM notes
    WHERE assignee_id IS NOT NULL
    ON CONFLICT (note_id, contact_id) DO NOTHING;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_note_assignees_note_id ON note_assignees(note_id);
CREATE INDEX IF NOT EXISTS idx_note_assignees_contact_id ON note_assignees(contact_id);

-- Enable RLS
ALTER TABLE note_assignees ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view assignees for their own notes" ON note_assignees;
DROP POLICY IF EXISTS "Users can insert assignees for their own notes" ON note_assignees;
DROP POLICY IF EXISTS "Users can delete assignees from their own notes" ON note_assignees;

-- Policy: Users can view assignees for their own notes
CREATE POLICY "Users can view assignees for their own notes"
  ON note_assignees
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = note_assignees.note_id
      AND notes.user_id = auth.uid()
    )
  );

-- Policy: Users can insert assignees for their own notes
CREATE POLICY "Users can insert assignees for their own notes"
  ON note_assignees
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = note_assignees.note_id
      AND notes.user_id = auth.uid()
    )
  );

-- Policy: Users can delete assignees from their own notes
CREATE POLICY "Users can delete assignees from their own notes"
  ON note_assignees
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = note_assignees.note_id
      AND notes.user_id = auth.uid()
    )
  );

-- Add comments
COMMENT ON TABLE note_assignees IS 'Junction table for many-to-many relationship between notes and contacts (assignees)';
COMMENT ON COLUMN note_assignees.note_id IS 'Reference to the note';
COMMENT ON COLUMN note_assignees.contact_id IS 'Reference to the contact assigned to this note';
COMMENT ON COLUMN note_assignees.created_at IS 'When this assignee was added to the note';

-- Note: We keep the assignee_id column in notes table for backward compatibility
-- It can be deprecated and removed in a future migration
