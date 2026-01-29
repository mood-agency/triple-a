-- Create storage bucket for note attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'note-attachments',
  'note-attachments',
  false,
  10485760, -- 10MB limit
  ARRAY[
    'image/png', 'image/jpeg', 'image/gif', 'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
);

-- RLS policies for storage
-- Users can upload to their own folder (user_id/note_id/filename)
CREATE POLICY "Users can upload own attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'note-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can view their own attachments
CREATE POLICY "Users can view own attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'note-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can update their own attachments
CREATE POLICY "Users can update own attachments"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'note-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete their own attachments
CREATE POLICY "Users can delete own attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'note-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
