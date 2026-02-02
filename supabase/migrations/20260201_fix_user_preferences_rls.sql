-- Migration: Fix Unrestricted user_preferences Table
-- Description: Reinforce Row Level Security (RLS) to ensure the table is not unrestricted
-- Date: 2026-02-01

-- 1. Ensure RLS is enabled and forced
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences FORCE ROW LEVEL SECURITY;

-- 2. Drop existing policies to ensure a clean slate
DROP POLICY IF EXISTS "Users can view own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can insert own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can delete own preferences" ON public.user_preferences;

-- 3. Create explicit policies for authenticated users
-- Only authenticated users can access their own data

-- Policy: Select own preferences
CREATE POLICY "Users can view own preferences"
  ON public.user_preferences
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Insert own preferences
CREATE POLICY "Users can insert own preferences"
  ON public.user_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Update own preferences
CREATE POLICY "Users can update own preferences"
  ON public.user_preferences
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Delete own preferences
CREATE POLICY "Users can delete own preferences"
  ON public.user_preferences
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. Explicitly revoke all on table from anon role to be extra safe
REVOKE ALL ON public.user_preferences FROM anon;
GRANT ALL ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_preferences TO service_role;

-- Add a comment to document the fix
COMMENT ON TABLE public.user_preferences IS 'Stores user preferences with strictly enforced RLS (authenticated users only)';
