-- Migration: Drop note_history_legacy table
-- Description: Removes the deprecated note_history_legacy table after migration to note_versions and note_actions
-- Date: 2026-01-29

DROP TABLE IF EXISTS note_history_legacy;
