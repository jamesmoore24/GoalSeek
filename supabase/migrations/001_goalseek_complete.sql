-- ============================================
-- GOALSEEK COMPLETE DATABASE SCHEMA
-- Single migration with all essential tables
-- ============================================

-- ============================================
-- HELPER FUNCTION: update_updated_at_column
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 1. PROFILES TABLE (user preferences)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 2. PURSUITS TABLE (top-level goals)
-- ============================================
CREATE TABLE IF NOT EXISTS pursuits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Core fields
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#3b82f6', -- Hex color for UI
  icon_name TEXT, -- Lucide icon name

  -- Timing
  weekly_hours_target NUMERIC NOT NULL DEFAULT 0,
  deadline TIMESTAMPTZ,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  priority INT NOT NULL DEFAULT 100, -- Lower = higher priority

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_pursuits_user_status ON pursuits(user_id, status, priority);
CREATE INDEX IF NOT EXISTS idx_pursuits_user_deadline ON pursuits(user_id, deadline) WHERE deadline IS NOT NULL;

-- ============================================
-- 3. SUBGOALS TABLE (SMART goals within pursuits)
-- ============================================
CREATE TABLE IF NOT EXISTS subgoals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pursuit_id UUID NOT NULL REFERENCES pursuits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Core fields
  name TEXT NOT NULL,
  description TEXT,

  -- SMART criteria (stored as JSONB for flexibility)
  smart_criteria JSONB NOT NULL DEFAULT '{
    "specific": "",
    "measurable": "",
    "achievable": "",
    "relevant": "",
    "timebound": ""
  }'::jsonb,

  -- Execution strategy
  execution_strategy TEXT, -- LLM-generated or user-defined approach
  daily_deliverable TEXT, -- What to accomplish per day
  session_deliverable TEXT, -- What to accomplish per work session

  -- Progress tracking
  intermediate_milestones JSONB DEFAULT '[]'::jsonb, -- Array of {name, completed, completed_at}
  deadline TIMESTAMPTZ,

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  priority INT NOT NULL DEFAULT 100,
  completed_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subgoals_pursuit ON subgoals(pursuit_id, status, priority);
CREATE INDEX IF NOT EXISTS idx_subgoals_user_deadline ON subgoals(user_id, deadline) WHERE deadline IS NOT NULL;

-- ============================================
-- 4. EXECUTABLES TABLE (concrete tasks)
-- ============================================
CREATE TABLE IF NOT EXISTS executables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subgoal_id UUID NOT NULL REFERENCES subgoals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Core fields
  title TEXT NOT NULL,
  description TEXT,

  -- Task metadata
  estimated_minutes INT, -- Time estimate
  priority INT NOT NULL DEFAULT 100,

  -- Completion
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_executables_subgoal ON executables(subgoal_id, completed);
CREATE INDEX IF NOT EXISTS idx_executables_user ON executables(user_id, completed);

-- ============================================
-- 5. DAY_LOGS TABLE (activity tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS day_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Time tracking
  started_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL,

  -- Links to pursuits (nullable for backward compatibility)
  pursuit_id UUID REFERENCES pursuits(id) ON DELETE SET NULL,
  subgoal_id UUID REFERENCES subgoals(id) ON DELETE SET NULL,
  executable_id UUID REFERENCES executables(id) ON DELETE SET NULL,

  -- Legacy tag field (kept for backward compatibility)
  tag TEXT CHECK (tag IN (
    'META', 'STARTUP', 'HEDGE', 'HEALTH', 'SOCIAL', 'ADMIN',
    'RECOVERY', 'MEETING', 'COMMUTE', 'LEARNING', 'WRITING', 'ERRANDS'
  )),

  -- Activity details
  intensity TEXT NOT NULL CHECK (intensity IN ('low', 'med', 'high')),
  description TEXT NOT NULL,
  outcome TEXT,
  needs_followup BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_day_logs_user_started_at ON day_logs(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_day_logs_pursuit ON day_logs(pursuit_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_day_logs_subgoal ON day_logs(subgoal_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_day_logs_user_tag ON day_logs(user_id, tag, started_at DESC);

-- ============================================
-- 6. PURSUIT_CONTEXT TABLE (documents for multimodal LLM)
-- ============================================
CREATE TABLE IF NOT EXISTS pursuit_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pursuit_id UUID NOT NULL REFERENCES pursuits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- File metadata
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'image', 'text', 'url')),
  mime_type TEXT,
  file_size_bytes BIGINT,

  -- Storage
  storage_path TEXT NOT NULL, -- Supabase Storage path or external URL
  content_text TEXT, -- Extracted text for PDFs/images (OCR)
  content_summary TEXT, -- LLM-generated summary

  -- Metadata
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pursuit_context_pursuit ON pursuit_context(pursuit_id);
CREATE INDEX IF NOT EXISTS idx_pursuit_context_user ON pursuit_context(user_id);

-- ============================================
-- 7. USER_MEMORIES TABLE (conversation takeaways)
-- ============================================
CREATE TABLE IF NOT EXISTS user_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- The compressed takeaway
  content TEXT NOT NULL,

  -- Optional categorization
  pursuit_id UUID REFERENCES pursuits(id) ON DELETE SET NULL,
  tags TEXT[],

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_memories_user ON user_memories(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_memories_pursuit ON user_memories(pursuit_id) WHERE pursuit_id IS NOT NULL;

-- ============================================
-- 8. USER_CONTEXT TABLE (user-level documents)
-- ============================================
CREATE TABLE IF NOT EXISTS user_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Category for organization
  category TEXT NOT NULL CHECK (category IN (
    'financial', 'health', 'legal', 'personal', 'other'
  )),

  -- File metadata
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'image', 'text', 'url')),
  mime_type TEXT,
  file_size_bytes BIGINT,

  -- Storage
  storage_path TEXT NOT NULL,
  content_text TEXT,
  content_summary TEXT,

  -- Metadata
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_context_user_category ON user_context(user_id, category);

-- ============================================
-- 9. USER_METRICS TABLE (time-series data)
-- ============================================
CREATE TABLE IF NOT EXISTS user_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Metric identification
  metric_type TEXT NOT NULL,
  metric_name TEXT NOT NULL,

  -- Time series
  recorded_at TIMESTAMPTZ NOT NULL,

  -- Flexible value storage
  value_numeric NUMERIC,
  value_text TEXT,
  value_json JSONB,

  -- Metadata
  source TEXT,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicates
  UNIQUE(user_id, metric_type, metric_name, recorded_at)
);

CREATE INDEX IF NOT EXISTS idx_user_metrics_user_time ON user_metrics(user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_metrics_type_name ON user_metrics(user_id, metric_type, metric_name, recorded_at DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pursuits ENABLE ROW LEVEL SECURITY;
ALTER TABLE subgoals ENABLE ROW LEVEL SECURITY;
ALTER TABLE executables ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pursuit_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_metrics ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Pursuits policies
CREATE POLICY "Users can view own pursuits" ON pursuits
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own pursuits" ON pursuits
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pursuits" ON pursuits
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own pursuits" ON pursuits
  FOR DELETE USING (auth.uid() = user_id);

-- Subgoals policies
CREATE POLICY "Users can view own subgoals" ON subgoals
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subgoals" ON subgoals
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own subgoals" ON subgoals
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own subgoals" ON subgoals
  FOR DELETE USING (auth.uid() = user_id);

-- Executables policies
CREATE POLICY "Users can view own executables" ON executables
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own executables" ON executables
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own executables" ON executables
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own executables" ON executables
  FOR DELETE USING (auth.uid() = user_id);

-- Day logs policies
CREATE POLICY "Users can view own day logs" ON day_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own day logs" ON day_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own day logs" ON day_logs
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own day logs" ON day_logs
  FOR DELETE USING (auth.uid() = user_id);

-- Pursuit context policies
CREATE POLICY "Users can view own pursuit context" ON pursuit_context
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own pursuit context" ON pursuit_context
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own pursuit context" ON pursuit_context
  FOR DELETE USING (auth.uid() = user_id);

-- User memories policies
CREATE POLICY "Users can view own memories" ON user_memories
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own memories" ON user_memories
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own memories" ON user_memories
  FOR DELETE USING (auth.uid() = user_id);

-- User context policies
CREATE POLICY "Users can view own user context" ON user_context
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own user context" ON user_context
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own user context" ON user_context
  FOR DELETE USING (auth.uid() = user_id);

-- User metrics policies
CREATE POLICY "Users can view own metrics" ON user_metrics
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own metrics" ON user_metrics
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own metrics" ON user_metrics
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own metrics" ON user_metrics
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pursuits_updated_at
  BEFORE UPDATE ON pursuits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subgoals_updated_at
  BEFORE UPDATE ON subgoals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_executables_updated_at
  BEFORE UPDATE ON executables
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER FUNCTION: Auto-create profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile when user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
