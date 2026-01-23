-- Migration: Add beeper_token to user_preferences
-- Description: Store Beeper API token for WhatsApp messaging integration
-- Date: 2026-01-23

-- Add beeper_token column to user_preferences
ALTER TABLE public.user_preferences
ADD COLUMN IF NOT EXISTS beeper_token TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.user_preferences.beeper_token IS 'API token for Beeper Desktop messaging integration';
