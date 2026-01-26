-- Support for multiple Google Calendar accounts per user
-- Each account stores its own OAuth tokens and can be linked to different projects

-- Create google_calendar_accounts table
CREATE TABLE IF NOT EXISTS google_calendar_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, email)
);

-- Add RLS policies
ALTER TABLE google_calendar_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own accounts"
  ON google_calendar_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own accounts"
  ON google_calendar_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own accounts"
  ON google_calendar_accounts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own accounts"
  ON google_calendar_accounts FOR DELETE
  USING (auth.uid() = user_id);

-- Add gcal_account_id to projects table to link project to specific Google account
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS gcal_account_id UUID REFERENCES google_calendar_accounts(id) ON DELETE SET NULL;

-- Add comment
COMMENT ON TABLE google_calendar_accounts IS 'Stores OAuth tokens for multiple Google Calendar accounts per user';
COMMENT ON COLUMN projects.gcal_account_id IS 'Google Calendar account to use for syncing this project';
