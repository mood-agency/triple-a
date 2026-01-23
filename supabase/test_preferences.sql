-- Test Script: Verify User Preferences Setup
-- Run this in Supabase SQL Editor to verify everything is configured correctly

-- ============================================
-- 1. Check if table exists
-- ============================================
SELECT
  EXISTS(
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'user_preferences'
  ) AS table_exists;

-- Expected: table_exists = true

-- ============================================
-- 2. Check table structure
-- ============================================
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_preferences'
ORDER BY ordinal_position;

-- Expected columns:
-- - user_id (uuid, NOT NULL)
-- - show_sidebar (boolean, NOT NULL, default false)
-- - auto_sync (boolean, NOT NULL, default true)
-- - created_at (timestamp with time zone, NOT NULL)
-- - updated_at (timestamp with time zone, NOT NULL)

-- ============================================
-- 3. Check RLS is enabled
-- ============================================
SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'user_preferences';

-- Expected: rowsecurity = true

-- ============================================
-- 4. Check RLS policies
-- ============================================
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_preferences'
ORDER BY policyname;

-- Expected policies:
-- - Users can view own preferences (SELECT)
-- - Users can insert own preferences (INSERT)
-- - Users can update own preferences (UPDATE)
-- - Users can delete own preferences (DELETE)

-- ============================================
-- 5. Check trigger exists
-- ============================================
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Expected: trigger exists on auth.users table

-- ============================================
-- 6. Check function exists
-- ============================================
SELECT
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'handle_new_user';

-- Expected: function exists with TRIGGER type

-- ============================================
-- 7. View existing preferences (if any)
-- ============================================
SELECT
  user_id,
  show_sidebar,
  auto_sync,
  created_at,
  updated_at
FROM user_preferences
ORDER BY created_at DESC
LIMIT 10;

-- ============================================
-- 8. Test default values (manual test)
-- ============================================
-- UNCOMMENT ONLY IF YOU WANT TO CREATE A TEST RECORD
-- WARNING: This will only work if you're authenticated as a user
/*
INSERT INTO user_preferences (user_id)
VALUES (auth.uid())
ON CONFLICT (user_id) DO NOTHING
RETURNING *;
*/

-- Expected: Record created with default values:
-- - show_sidebar = false
-- - auto_sync = true

-- ============================================
-- 9. Test update trigger
-- ============================================
-- UNCOMMENT TO TEST (only if you have a record)
/*
UPDATE user_preferences
SET show_sidebar = NOT show_sidebar
WHERE user_id = auth.uid()
RETURNING user_id, show_sidebar, updated_at;
*/

-- Expected: updated_at should be updated automatically

-- ============================================
-- 10. Check indexes
-- ============================================
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'user_preferences';

-- Expected: At least primary key on user_id

-- ============================================
-- RESULTS SUMMARY
-- ============================================
-- All tests should return the expected values above.
-- If any test fails, review the migration files and ensure they were applied correctly.
