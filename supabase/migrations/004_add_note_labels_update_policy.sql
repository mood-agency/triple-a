-- Add UPDATE policy for note_labels table
-- This is needed for upsert operations during sync

CREATE POLICY "Users can update own note-labels"
  ON public.note_labels FOR UPDATE
  USING (auth.uid() = user_id);
