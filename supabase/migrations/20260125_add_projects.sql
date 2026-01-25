-- Migration: Add projects table and note-project relationship
-- Description: Creates projects entity that can contain multiple notes
-- Date: 2026-01-25

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#6b7280',
  icon TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Add project_id column to notes table
ALTER TABLE notes ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Create index for filtering notes by project
CREATE INDEX IF NOT EXISTS idx_notes_project_id ON notes(project_id) WHERE project_id IS NOT NULL;

-- Create index for user's projects
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

-- Create index for active projects
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(user_id, status) WHERE deleted_at IS NULL;

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own projects
CREATE POLICY "Users can view own projects"
  ON projects
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own projects
CREATE POLICY "Users can insert own projects"
  ON projects
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own projects
CREATE POLICY "Users can update own projects"
  ON projects
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own projects
CREATE POLICY "Users can delete own projects"
  ON projects
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_projects_timestamp
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_projects_updated_at();

-- Add comments
COMMENT ON TABLE projects IS 'Projects that can contain multiple notes/tasks';
COMMENT ON COLUMN projects.name IS 'Project name';
COMMENT ON COLUMN projects.description IS 'Optional project description';
COMMENT ON COLUMN projects.color IS 'Hex color code for visual identification';
COMMENT ON COLUMN projects.icon IS 'Optional emoji or icon identifier';
COMMENT ON COLUMN projects.status IS 'Project status: active, archived, or completed';
COMMENT ON COLUMN projects.sort_order IS 'Order for sorting projects in lists';
COMMENT ON COLUMN notes.project_id IS 'Optional reference to the project this note belongs to';
