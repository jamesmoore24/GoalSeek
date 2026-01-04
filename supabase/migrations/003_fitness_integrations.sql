-- ============================================
-- STRAVA INTEGRATION
-- Adds columns to user_integrations table
-- ============================================

-- Add Strava columns
ALTER TABLE user_integrations
ADD COLUMN IF NOT EXISTS strava_connected BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS strava_access_token TEXT,
ADD COLUMN IF NOT EXISTS strava_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS strava_token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS strava_athlete_id TEXT;

-- Note: Garmin integration uses direct login via garmin-connect library
-- and stores session tokens locally (not in database)
