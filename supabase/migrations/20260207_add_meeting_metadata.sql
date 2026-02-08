-- Add meeting metadata columns to notes table
-- These fields are populated by Google Calendar sync

ALTER TABLE notes ADD COLUMN IF NOT EXISTS meeting_link TEXT;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS meeting_attendees JSONB;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS gcal_html_link TEXT;
