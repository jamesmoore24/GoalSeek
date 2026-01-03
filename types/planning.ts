// Day Planning System Types

// ============================================
// ENUMS / CONSTANTS
// ============================================

export const DAY_LOG_TAGS = [
  'META',
  'STARTUP',
  'HEDGE',
  'HEALTH',
  'SOCIAL',
  'ADMIN',
  'RECOVERY',
  'MEETING',
  'COMMUTE',
  'LEARNING',
  'WRITING',
  'ERRANDS',
] as const;

export type DayLogTag = typeof DAY_LOG_TAGS[number];

export const INTENSITY_LEVELS = ['low', 'med', 'high'] as const;
export type Intensity = typeof INTENSITY_LEVELS[number];

export const LOCATION_CONTEXTS = ['home', 'office', 'gym', 'commute', 'other', 'unknown'] as const;
export type LocationContext = typeof LOCATION_CONTEXTS[number];

export const RULE_TYPES = ['hard', 'soft'] as const;
export type RuleType = typeof RULE_TYPES[number];

export const PLAN_STATUSES = ['proposed', 'accepted', 'skipped', 'completed'] as const;
export type PlanStatus = typeof PLAN_STATUSES[number];

// ============================================
// DATABASE TYPES
// ============================================

export interface Profile {
  id: string;
  timezone: string;
  day_start_time: string; // TIME as string "HH:MM"
  caffeine_cutoff_time: string;
  bedtime: string;
  intense_block_minutes: number;
  no_intense_within_hours_of_bed: number;
  created_at: string;
  updated_at: string;
}

export interface WeeklyTargets {
  id: string;
  user_id: string;
  week_start: string; // DATE as string "YYYY-MM-DD"
  // Work
  meta_hours_target: number;
  startup_hours_target: number;
  hedge_hours_target: number;
  // Health
  cardio_sessions_target: number;
  cardio_minutes_target: number;
  strength_sessions_target: number;
  mobility_sessions_target: number;
  sleep_avg_target: number;
  // Other
  social_hours_target: number;
  writing_hours_target: number;
  admin_hours_target: number;
  created_at: string;
}

export interface Rule {
  id: string;
  user_id: string;
  name: string;
  type: RuleType;
  rule_text: string;
  is_active: boolean;
  priority: number;
  created_at: string;
}

export interface DayLog {
  id: string;
  user_id: string;
  started_at: string;
  duration_minutes: number;
  tag: DayLogTag;
  intensity: Intensity;
  description: string;
  outcome?: string | null;
  needs_followup: boolean;
  created_at: string;
}

export interface StateSnapshot {
  id: string;
  user_id: string;
  captured_at: string;
  location_context: LocationContext;
  sleep_hours: number;
  sleep_quality: number; // 1-10
  caffeine_mg: number;
  last_meal_at?: string | null;
  energy: number; // 1-10
  focus: number; // 1-10
  stress: number; // 1-10
  body_readiness: number; // 1-10
  social_battery: number; // 1-10
  notes?: string | null;
  image_url?: string | null;
}

export interface Plan {
  id: string;
  user_id: string;
  created_at: string;
  for_date: string;
  input_snapshot_id?: string | null;
  context_window_start: string;
  context_window_end: string;
  plan_json: PlanOutput;
  model: string;
  prompt_version: string;
  status: PlanStatus;
}

export interface PlanFeedback {
  id: string;
  plan_id: string;
  user_id: string;
  rating: number; // 1-5
  followed: boolean;
  notes?: string | null;
  created_at: string;
}

// ============================================
// LLM OUTPUT SCHEMA
// ============================================

export interface PlanBlock {
  start_time: string; // "HH:MM"
  end_time: string;
  task: string;
  intensity: Intensity;
  definition_of_done: string[];
}

export interface SecondaryBlock extends PlanBlock {
  enabled: boolean;
  trigger_condition: string;
}

export interface ConstraintCheck {
  ok: boolean;
  reason?: string;
  missing?: string[];
}

export interface PlanOutput {
  next_block: PlanBlock;
  secondary_block?: SecondaryBlock;
  pacing: {
    pre: string[];
    post: string[];
  };
  constraints_check: {
    no_double_dip: ConstraintCheck;
    health_floor: ConstraintCheck;
    social_floor: ConstraintCheck;
    sleep_protected: ConstraintCheck;
  };
  fallback_if_low_energy: {
    task: string;
    duration_minutes: number;
    definition_of_done: string[];
  };
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

// Day Log
export interface CreateDayLogRequest {
  started_at: string;
  duration_minutes: number;
  tag: DayLogTag;
  intensity: Intensity;
  description: string;
  outcome?: string;
  needs_followup?: boolean;
}

// State Snapshot
export interface CreateStateSnapshotRequest {
  location_context?: LocationContext;
  sleep_hours: number;
  sleep_quality: number;
  caffeine_mg?: number;
  last_meal_at?: string;
  energy: number;
  focus: number;
  stress: number;
  body_readiness: number;
  social_battery: number;
  notes?: string;
  image_url?: string; // base64 or URL for multimodal
}

// Profile
export interface UpdateProfileRequest {
  timezone?: string;
  day_start_time?: string;
  caffeine_cutoff_time?: string;
  bedtime?: string;
  intense_block_minutes?: number;
  no_intense_within_hours_of_bed?: number;
}

// Weekly Targets
export interface CreateWeeklyTargetsRequest {
  week_start: string;
  meta_hours_target?: number;
  startup_hours_target?: number;
  hedge_hours_target?: number;
  cardio_sessions_target?: number;
  cardio_minutes_target?: number;
  strength_sessions_target?: number;
  mobility_sessions_target?: number;
  sleep_avg_target?: number;
  social_hours_target?: number;
  writing_hours_target?: number;
  admin_hours_target?: number;
}

// Rules
export interface CreateRuleRequest {
  name: string;
  type: RuleType;
  rule_text: string;
  is_active?: boolean;
  priority?: number;
}

export interface UpdateRuleRequest {
  name?: string;
  type?: RuleType;
  rule_text?: string;
  is_active?: boolean;
  priority?: number;
}

// Plan Generation
export interface GeneratePlanRequest {
  snapshot_id?: string; // Use existing snapshot, or create from current state
  current_state?: CreateStateSnapshotRequest; // Create new snapshot on the fly
}

export interface GeneratePlanResponse {
  plan: Plan;
  snapshot: StateSnapshot;
}

// Plan Feedback
export interface CreatePlanFeedbackRequest {
  rating: number;
  followed: boolean;
  notes?: string;
}

// ============================================
// DERIVED / COMPUTED TYPES
// ============================================

export interface WeeklyProgress {
  week_start: string;
  // Hours logged by tag
  meta_hours: number;
  startup_hours: number;
  hedge_hours: number;
  social_hours: number;
  writing_hours: number;
  admin_hours: number;
  // Health metrics
  cardio_sessions: number;
  cardio_minutes: number;
  strength_sessions: number;
  mobility_sessions: number;
  avg_sleep_hours: number;
  // Totals
  total_work_hours: number;
  total_health_minutes: number;
}

export interface DerivedFlags {
  last_intense_block_at?: string;
  minutes_since_last_intense?: number;
  health_floor_met_today: boolean;
  social_floor_met_today: boolean;
  minutes_until_bedtime: number;
  minutes_until_no_intense_window: number;
  caffeine_allowed: boolean;
  outdoor_light_today: boolean;
}

export interface PlanContext {
  profile: Profile;
  weekly_targets: WeeklyTargets;
  weekly_progress: WeeklyProgress;
  active_rules: Rule[];
  current_state: StateSnapshot;
  today_logs: DayLog[];
  derived_flags: DerivedFlags;
}
