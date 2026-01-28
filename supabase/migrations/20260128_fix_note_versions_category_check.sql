-- Fix: note_versions category constraint to match app's NoteCategory type
-- App uses: 'todo', 'followup', 'notes', 'meeting'
-- DB had: 'todo', 'idea', 'meeting', 'reminder'

ALTER TABLE note_versions DROP CONSTRAINT IF EXISTS note_versions_category_check;
ALTER TABLE note_versions ADD CONSTRAINT note_versions_category_check
  CHECK (category IN ('todo', 'followup', 'notes', 'meeting'));
