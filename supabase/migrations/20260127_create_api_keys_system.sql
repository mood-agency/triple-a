-- Migration: Create API Keys and Audit Log System
-- Created: 2026-01-27
-- Description: Creates tables for API key management and audit logging

-- ============================================
-- API Keys Table
-- ============================================

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['read'],
  rate_limit INTEGER NOT NULL DEFAULT 100,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  CONSTRAINT api_keys_name_not_empty CHECK (name <> ''),
  CONSTRAINT api_keys_rate_limit_positive CHECK (rate_limit > 0)
);

-- Indexes for performance
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash) WHERE revoked_at IS NULL;
CREATE INDEX idx_api_keys_expires_at ON api_keys(expires_at) WHERE expires_at IS NOT NULL AND revoked_at IS NULL;

-- Enable Row Level Security
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own API keys"
  ON api_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own API keys"
  ON api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own API keys"
  ON api_keys FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own API keys"
  ON api_keys FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- API Audit Log Table
-- ============================================

CREATE TABLE IF NOT EXISTS api_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  status_code INTEGER,
  ip_address INET,
  user_agent TEXT,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT api_audit_log_method_valid CHECK (method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'))
);

-- Indexes for performance
CREATE INDEX idx_api_audit_log_api_key_id ON api_audit_log(api_key_id);
CREATE INDEX idx_api_audit_log_user_id ON api_audit_log(user_id);
CREATE INDEX idx_api_audit_log_created_at ON api_audit_log(created_at DESC);

-- Enable Row Level Security
ALTER TABLE api_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for audit log
CREATE POLICY "Users can view own audit logs"
  ON api_audit_log FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================
-- Triggers
-- ============================================

-- Trigger to update updated_at timestamp on api_keys
CREATE OR REPLACE FUNCTION update_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_api_keys_updated_at();

-- ============================================
-- Comments for documentation
-- ============================================

COMMENT ON TABLE api_keys IS 'Stores hashed API keys for external service authentication';
COMMENT ON COLUMN api_keys.key_hash IS 'Bcrypt hash of the full API key (sk_live_...)';
COMMENT ON COLUMN api_keys.key_prefix IS 'First 12 characters of the key for display purposes';
COMMENT ON COLUMN api_keys.scopes IS 'Array of permissions: read, write, delete';
COMMENT ON COLUMN api_keys.rate_limit IS 'Maximum requests per minute allowed for this key';

COMMENT ON TABLE api_audit_log IS 'Logs all API requests for security and analytics';
COMMENT ON COLUMN api_audit_log.response_time_ms IS 'Time taken to process the request in milliseconds';
