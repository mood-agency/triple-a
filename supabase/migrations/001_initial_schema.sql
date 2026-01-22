-- Triple-A Supabase Schema
-- Run this in your Supabase SQL Editor

-- ============================================
-- 1. PROFILES TABLE (extends auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 2. NOTES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  content TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'todo' CHECK (category IN ('todo', 'followup', 'notes')),
  completed BOOLEAN NOT NULL DEFAULT false,
  pinned BOOLEAN NOT NULL DEFAULT false,
  sort_order NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ -- Soft delete for sync
);

CREATE INDEX IF NOT EXISTS idx_notes_user_date ON public.notes(user_id, date);
CREATE INDEX IF NOT EXISTS idx_notes_user_updated ON public.notes(user_id, updated_at);

-- ============================================
-- 3. NOTE HISTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.note_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_note_history_note_id ON public.note_history(note_id);
CREATE INDEX IF NOT EXISTS idx_note_history_user ON public.note_history(user_id);

-- ============================================
-- 4. LABELS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6b7280',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_labels_user_id ON public.labels(user_id);

-- ============================================
-- 5. NOTE_LABELS JUNCTION TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.note_labels (
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  PRIMARY KEY (note_id, label_id)
);

CREATE INDEX IF NOT EXISTS idx_note_labels_note_id ON public.note_labels(note_id);
CREATE INDEX IF NOT EXISTS idx_note_labels_label_id ON public.note_labels(label_id);

-- ============================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_labels ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Notes policies
CREATE POLICY "Users can view own notes"
  ON public.notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own notes"
  ON public.notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes"
  ON public.notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes"
  ON public.notes FOR DELETE
  USING (auth.uid() = user_id);

-- Note history policies
CREATE POLICY "Users can view own note history"
  ON public.note_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own note history"
  ON public.note_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Labels policies
CREATE POLICY "Users can view own labels"
  ON public.labels FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own labels"
  ON public.labels FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own labels"
  ON public.labels FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own labels"
  ON public.labels FOR DELETE
  USING (auth.uid() = user_id);

-- Note-labels policies
CREATE POLICY "Users can view own note-labels"
  ON public.note_labels FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own note-labels"
  ON public.note_labels FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own note-labels"
  ON public.note_labels FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 7. FUNCTIONS AND TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER labels_updated_at
  BEFORE UPDATE ON public.labels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile when user signs up
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- 8. ENABLE REALTIME
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.labels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.note_labels;
