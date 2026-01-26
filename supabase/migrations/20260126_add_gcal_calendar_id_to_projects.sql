-- Add gcal_calendar_id to projects table for per-project calendar sync
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS gcal_calendar_id TEXT;

-- Add comment
COMMENT ON COLUMN projects.gcal_calendar_id IS 'Google Calendar ID to sync events from for this project';
