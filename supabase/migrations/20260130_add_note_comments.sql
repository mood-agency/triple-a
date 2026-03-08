-- Create note_comments table for inline comments on notes
CREATE TABLE note_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES note_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  block_id TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  -- Sync fields
  remote_id UUID,
  sync_status TEXT NOT NULL DEFAULT 'local' CHECK (sync_status IN ('local', 'pending', 'synced', 'conflict')),
  last_synced_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX idx_note_comments_note_id ON note_comments(note_id);
CREATE INDEX idx_note_comments_thread_id ON note_comments(thread_id);
CREATE INDEX idx_note_comments_user_id ON note_comments(user_id);
CREATE INDEX idx_note_comments_block_id ON note_comments(block_id);
CREATE INDEX idx_note_comments_sync_status ON note_comments(sync_status) WHERE sync_status != 'synced';

-- Enable RLS
ALTER TABLE note_comments ENABLE ROW LEVEL SECURITY;

-- RLS policies
-- Users can view comments on notes they own
CREATE POLICY "Users can view comments on own notes"
ON note_comments FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR note_id IN (SELECT id FROM notes WHERE user_id = auth.uid())
);

-- Users can create comments on notes they own
CREATE POLICY "Users can create comments on own notes"
ON note_comments FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND note_id IN (SELECT id FROM notes WHERE user_id = auth.uid())
);

-- Users can update their own comments
CREATE POLICY "Users can update own comments"
ON note_comments FOR UPDATE TO authenticated
USING (user_id = auth.uid());

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments"
ON note_comments FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- updated_at is managed by the application code (no DB trigger)
