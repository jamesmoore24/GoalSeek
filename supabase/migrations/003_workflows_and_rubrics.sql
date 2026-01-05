-- ============================================
-- WORKFLOWS AND RUBRICS SYSTEM
-- For /planmyday and custom workflow automation
-- ============================================

-- ============================================
-- 1. WORKFLOWS TABLE (workflow definitions)
-- ============================================
CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Identity
  name TEXT NOT NULL,
  slug TEXT NOT NULL, -- Command name (e.g., "planmyday" for /planmyday)
  description TEXT,

  -- Configuration
  is_system BOOLEAN NOT NULL DEFAULT false, -- Pre-coded vs user-created
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Workflow definition (for custom workflows)
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Steps array format:
  -- [
  --   { "type": "fetch_data", "source": "calendar", "config": {...} },
  --   { "type": "fetch_data", "source": "memories", "config": {...} },
  --   { "type": "analyze", "prompt_template": "...", "config": {...} },
  --   { "type": "validate_rubric", "config": {...} },
  --   { "type": "user_interaction", "interaction_type": "proposal", "config": {...} },
  --   { "type": "write_output", "destination": "calendar", "config": {...} }
  -- ]

  -- Enabled integrations for this workflow
  enabled_integrations TEXT[] NOT NULL DEFAULT '{}',

  -- Expected output format
  expected_output_format JSONB,

  -- Autonomous scheduling (null = manual only)
  autonomous_schedule JSONB, -- { "enabled": true, "cron": "0 6 * * *", "timezone": "America/Los_Angeles" }

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_workflows_user_active ON workflows(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_workflows_slug ON workflows(user_id, slug);

-- ============================================
-- 2. WORKFLOW_RUBRICS TABLE (validation rules per workflow)
-- ============================================
CREATE TABLE IF NOT EXISTS workflow_rubrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Rubric definition
  category TEXT NOT NULL, -- e.g., "health", "time", "metabolic", "sleep", "productivity"
  name TEXT NOT NULL, -- e.g., "Morning sunlight exposure"
  description TEXT, -- Detailed description of the constraint

  -- Constraint type
  constraint_type TEXT NOT NULL DEFAULT 'soft' CHECK (constraint_type IN ('hard', 'soft')),
  -- hard = must pass, workflow fails if not met
  -- soft = should pass, reduces score but doesn't fail

  -- Validation
  validation_rule JSONB NOT NULL,
  -- Format:
  -- { "type": "time_window", "start": "06:00", "end": "10:00", "activity": "outdoor" }
  -- { "type": "no_overlap", "with": "sleep_time" }
  -- { "type": "minimum_gap", "between": "caffeine", "and": "sleep", "hours": 8 }
  -- { "type": "custom", "function": "validateMorningRoutine" }

  -- Scoring
  weight INT NOT NULL DEFAULT 1, -- Weight for soft constraints (1-10)

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rubrics_workflow ON workflow_rubrics(workflow_id, is_active);
CREATE INDEX IF NOT EXISTS idx_rubrics_category ON workflow_rubrics(workflow_id, category);

-- ============================================
-- 3. WORKFLOW_EXECUTIONS TABLE (execution history)
-- ============================================
CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Execution status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Not started
    'running',      -- In progress
    'awaiting_user', -- Waiting for user input
    'completed',    -- Successfully finished
    'failed',       -- Error occurred
    'cancelled'     -- User cancelled
  )),

  -- Execution data
  input_data JSONB, -- Data gathered at start
  current_step INT NOT NULL DEFAULT 0,
  step_results JSONB NOT NULL DEFAULT '[]'::jsonb, -- Results from each step

  -- Rubric validation results
  rubric_results JSONB, -- { "score": 85, "passed": true, "details": [...] }

  -- Output
  output_data JSONB, -- Final result (e.g., generated agenda)

  -- For user interaction
  pending_proposal JSONB, -- Current proposal awaiting user response
  user_feedback TEXT[], -- Array of user feedback messages
  iteration_count INT NOT NULL DEFAULT 0,

  -- Error tracking
  error_message TEXT,
  error_step INT,

  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_executions_workflow ON workflow_executions(workflow_id, status);
CREATE INDEX IF NOT EXISTS idx_executions_user_status ON workflow_executions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_executions_user_recent ON workflow_executions(user_id, created_at DESC);

-- ============================================
-- 4. AGENDA_ITEMS TABLE (generated schedule items)
-- ============================================
CREATE TABLE IF NOT EXISTS agenda_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID REFERENCES workflow_executions(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Timing
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,

  -- Content
  title TEXT NOT NULL,
  description TEXT,

  -- Categorization
  category TEXT, -- Maps to day_log tags: META, STARTUP, HEALTH, etc.
  pursuit_id UUID REFERENCES pursuits(id) ON DELETE SET NULL,
  subgoal_id UUID REFERENCES subgoals(id) ON DELETE SET NULL,

  -- Attributes
  intensity TEXT CHECK (intensity IN ('low', 'medium', 'high')),
  location TEXT,

  -- Calendar sync
  google_event_id TEXT, -- ID of synced Google Calendar event
  synced_at TIMESTAMPTZ,

  -- Status
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN (
    'proposed',   -- Generated but not approved
    'approved',   -- User approved
    'synced',     -- Synced to calendar
    'completed',  -- User marked as done
    'skipped'     -- User skipped
  )),

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agenda_user_date ON agenda_items(user_id, date, start_time);
CREATE INDEX IF NOT EXISTS idx_agenda_execution ON agenda_items(execution_id);
CREATE INDEX IF NOT EXISTS idx_agenda_google_event ON agenda_items(google_event_id) WHERE google_event_id IS NOT NULL;

-- ============================================
-- 5. USER PREFERENCES FOR WORKFLOWS
-- Add columns to profiles table
-- ============================================
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS day_start_time TIME DEFAULT '07:00',
ADD COLUMN IF NOT EXISTS day_end_time TIME DEFAULT '22:00',
ADD COLUMN IF NOT EXISTS sleep_time TIME DEFAULT '23:00',
ADD COLUMN IF NOT EXISTS wake_time TIME DEFAULT '07:00',
ADD COLUMN IF NOT EXISTS caffeine_cutoff_hours INT DEFAULT 8, -- Hours before sleep
ADD COLUMN IF NOT EXISTS morning_sunlight_minutes INT DEFAULT 15,
ADD COLUMN IF NOT EXISTS preferred_workout_time TEXT DEFAULT 'morning' CHECK (preferred_workout_time IN ('morning', 'afternoon', 'evening', 'flexible'));

-- ============================================
-- 6. ROW LEVEL SECURITY POLICIES
-- ============================================

-- Workflows
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own workflows"
  ON workflows FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own workflows"
  ON workflows FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workflows"
  ON workflows FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workflows"
  ON workflows FOR DELETE
  USING (auth.uid() = user_id);

-- Workflow Rubrics
ALTER TABLE workflow_rubrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rubrics"
  ON workflow_rubrics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own rubrics"
  ON workflow_rubrics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rubrics"
  ON workflow_rubrics FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own rubrics"
  ON workflow_rubrics FOR DELETE
  USING (auth.uid() = user_id);

-- Workflow Executions
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own executions"
  ON workflow_executions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own executions"
  ON workflow_executions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own executions"
  ON workflow_executions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own executions"
  ON workflow_executions FOR DELETE
  USING (auth.uid() = user_id);

-- Agenda Items
ALTER TABLE agenda_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own agenda items"
  ON agenda_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own agenda items"
  ON agenda_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own agenda items"
  ON agenda_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own agenda items"
  ON agenda_items FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 7. TRIGGERS FOR updated_at
-- ============================================
CREATE TRIGGER update_workflows_updated_at
  BEFORE UPDATE ON workflows
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_rubrics_updated_at
  BEFORE UPDATE ON workflow_rubrics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_executions_updated_at
  BEFORE UPDATE ON workflow_executions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agenda_items_updated_at
  BEFORE UPDATE ON agenda_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 8. SEED DEFAULT /planmyday WORKFLOW
-- ============================================
-- Note: This will be inserted per-user when they first access workflows
-- The system workflow template is defined in code
