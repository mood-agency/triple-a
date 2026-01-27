-- Migration: Split note_history into note_versions and note_actions
-- Description: Separates content snapshots from action metadata for storage efficiency
-- Date: 2026-01-28

-- ============================================================================
-- STEP 1: Rename existing note_history to note_history_legacy
-- ============================================================================
-- This preserves existing history data for reference without interfering with new tables

ALTER TABLE IF EXISTS note_history RENAME TO note_history_legacy;

-- ============================================================================
-- STEP 2: Create note_versions table
-- ============================================================================
-- Purpose: Store complete content snapshots for version restoration
-- Used for: 'created' and 'edit' actions only

CREATE TABLE note_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Complete content snapshot
  content TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('todo', 'idea', 'meeting', 'reminder')),
  completed BOOLEAN NOT NULL DEFAULT false,

  -- Version metadata
  version_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Synchronization fields
  remote_id UUID,
  sync_status TEXT DEFAULT 'local' CHECK (sync_status IN ('local', 'pending', 'synced', 'conflict')),
  last_synced_at TIMESTAMPTZ
);

-- Create indexes for note_versions
CREATE INDEX idx_note_versions_note_id ON note_versions(note_id, version_number DESC);
CREATE INDEX idx_note_versions_user_id ON note_versions(user_id);
CREATE INDEX idx_note_versions_created_at ON note_versions(note_id, created_at DESC);

-- Enable RLS for note_versions
ALTER TABLE note_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for note_versions
CREATE POLICY "Users can view own note versions"
  ON note_versions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own note versions"
  ON note_versions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own note versions"
  ON note_versions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own note versions"
  ON note_versions FOR DELETE
  USING (auth.uid() = user_id);

-- Add table comment
COMMENT ON TABLE note_versions IS 'Content version snapshots for note restoration (created, edit actions)';

-- ============================================================================
-- STEP 3: Create note_actions table
-- ============================================================================
-- Purpose: Store lightweight action metadata for postpone tracking
-- Used for: 'postponed' actions only (no content/description stored)

CREATE TABLE note_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Action metadata (lightweight, no content)
  action_type TEXT NOT NULL DEFAULT 'postponed' CHECK (action_type = 'postponed'),
  reason TEXT,
  previous_date TIMESTAMPTZ,
  new_date TIMESTAMPTZ,

  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Synchronization fields
  remote_id UUID,
  sync_status TEXT DEFAULT 'local' CHECK (sync_status IN ('local', 'pending', 'synced', 'conflict')),
  last_synced_at TIMESTAMPTZ
);

-- Create indexes for note_actions
CREATE INDEX idx_note_actions_note_id ON note_actions(note_id, created_at DESC);
CREATE INDEX idx_note_actions_user_id ON note_actions(user_id);
CREATE INDEX idx_note_actions_type ON note_actions(note_id, action_type);

-- Enable RLS for note_actions
ALTER TABLE note_actions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for note_actions
CREATE POLICY "Users can view own note actions"
  ON note_actions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own note actions"
  ON note_actions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own note actions"
  ON note_actions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own note actions"
  ON note_actions FOR DELETE
  USING (auth.uid() = user_id);

-- Add table comment
COMMENT ON TABLE note_actions IS 'Lightweight action history for postpone tracking (no content snapshots)';

-- ============================================================================
-- Migration Notes
-- ============================================================================
-- * Old data is preserved in note_history_legacy table
-- * New tables start empty (no data migration)
-- * Frontend will start using new tables immediately
-- * Old history remains accessible in note_history_legacy for reference
-- * Storage savings: ~70-90% for postpone actions (no content/description)
