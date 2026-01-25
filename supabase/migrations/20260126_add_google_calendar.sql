-- Google Calendar Integration Tables
-- Migration: 20260126_add_google_calendar.sql

-- Tokens OAuth de Google Calendar (almacenados de forma segura en el servidor)
CREATE TABLE google_calendar_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ NOT NULL,
  scope TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configuración de sincronización por usuario
CREATE TABLE google_calendar_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  enabled BOOLEAN DEFAULT false,
  -- Calendarios seleccionados para importar (JSON array de calendar IDs)
  calendars_to_sync JSONB DEFAULT '[]'::jsonb,
  -- Categoría por defecto para eventos importados
  default_category TEXT DEFAULT 'meeting',
  -- Última sincronización exitosa
  last_sync_at TIMESTAMPTZ,
  -- Intervalo de sync automático en minutos (0 = solo manual)
  sync_interval_minutes INTEGER DEFAULT 15,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mapeo de eventos importados (para tracking de cambios)
CREATE TABLE google_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  gcal_event_id TEXT NOT NULL,
  gcal_calendar_id TEXT NOT NULL,
  local_note_id TEXT NOT NULL,
  etag TEXT,
  event_status TEXT DEFAULT 'confirmed',
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, gcal_event_id)
);

-- Índices para búsquedas eficientes
CREATE INDEX idx_gcal_events_user_id ON google_calendar_events(user_id);
CREATE INDEX idx_gcal_events_local_note_id ON google_calendar_events(user_id, local_note_id);
CREATE INDEX idx_gcal_config_user_id ON google_calendar_config(user_id);

-- Row Level Security
ALTER TABLE google_calendar_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_calendar_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_calendar_events ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: cada usuario solo puede acceder a sus propios datos
CREATE POLICY "Users can only access their own tokens"
  ON google_calendar_tokens FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own config"
  ON google_calendar_config FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own event mappings"
  ON google_calendar_events FOR ALL
  USING (auth.uid() = user_id);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_google_calendar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_google_calendar_tokens_updated_at
  BEFORE UPDATE ON google_calendar_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_google_calendar_updated_at();

CREATE TRIGGER update_google_calendar_config_updated_at
  BEFORE UPDATE ON google_calendar_config
  FOR EACH ROW
  EXECUTE FUNCTION update_google_calendar_updated_at();
