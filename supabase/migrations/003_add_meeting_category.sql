-- Add 'meeting' to the allowed categories for notes
-- This aligns the database constraint with the TypeScript NoteCategory type

ALTER TABLE public.notes DROP CONSTRAINT notes_category_check;
ALTER TABLE public.notes ADD CONSTRAINT notes_category_check CHECK (category IN ('todo', 'followup', 'notes', 'meeting'));
