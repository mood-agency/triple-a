-- Add gcal_event_id column to notes table for Google Calendar integration
-- Migration: 20260126_add_gcal_event_id_to_notes.sql

-- Add the column (nullable to support existing notes)
ALTER TABLE notes ADD COLUMN IF NOT EXISTS gcal_event_id TEXT;

-- Create index for efficient lookups by gcal_event_id
CREATE INDEX IF NOT EXISTS idx_notes_gcal_event_id ON notes(gcal_event_id) WHERE gcal_event_id IS NOT NULL;
