-- ============================================
-- GOOGLE CALENDAR INTEGRATION
-- Stores OAuth tokens and calendar preferences
-- ============================================

-- ============================================
-- USER INTEGRATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Google Calendar OAuth
  google_calendar_connected BOOLEAN NOT NULL DEFAULT FALSE,
  google_access_token TEXT,
  google_refresh_token TEXT,
  google_token_expires_at TIMESTAMPTZ,
  google_calendar_scopes TEXT[],
  google_selected_calendars TEXT[], -- Calendar IDs to sync (NULL = all calendars)

  -- Privacy settings
  calendar_sync_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  share_event_titles BOOLEAN NOT NULL DEFAULT TRUE,
  share_event_descriptions BOOLEAN NOT NULL DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_integrations_user ON user_integrations(user_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own integrations" ON user_integrations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own integrations" ON user_integrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own integrations" ON user_integrations
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own integrations" ON user_integrations
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- TRIGGER: Auto-update updated_at
-- ============================================
CREATE TRIGGER update_user_integrations_updated_at
  BEFORE UPDATE ON user_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
