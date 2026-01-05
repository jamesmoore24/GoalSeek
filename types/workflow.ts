// ============================================
// WORKFLOW AND RUBRIC SYSTEM TYPES
// ============================================

// ============================================
// WORKFLOW TYPES
// ============================================

export type WorkflowStepType =
  | 'fetch_data'
  | 'analyze'
  | 'validate_rubric'
  | 'user_interaction'
  | 'write_output';

export type DataSource =
  | 'calendar'
  | 'memories'
  | 'pursuits'
  | 'day_logs'
  | 'profile'
  | 'context_files';

export type OutputDestination =
  | 'calendar'
  | 'agenda'
  | 'notification';

export interface WorkflowStepConfig {
  // For fetch_data steps
  source?: DataSource;
  query?: string;
  limit?: number;
  date_range?: {
    start: string; // ISO date or relative like "today"
    end: string;
  };

  // For analyze steps
  prompt_template?: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;

  // For validate_rubric steps
  min_score?: number;
  max_iterations?: number;

  // For user_interaction steps
  interaction_type?: 'proposal' | 'confirmation' | 'feedback';
  timeout_minutes?: number;

  // For write_output steps
  destination?: OutputDestination;
  calendar_id?: string;
}

export interface WorkflowStep {
  type: WorkflowStepType;
  name?: string;
  description?: string;
  config: WorkflowStepConfig;
}

export interface AutonomousSchedule {
  enabled: boolean;
  cron: string; // Cron expression, e.g., "0 6 * * *" for 6am daily
  timezone: string;
  last_run?: string;
  next_run?: string;
}

export interface Workflow {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  description?: string | null;
  is_system: boolean;
  is_active: boolean;
  steps: WorkflowStep[];
  enabled_integrations: string[];
  expected_output_format?: Record<string, unknown> | null;
  autonomous_schedule?: AutonomousSchedule | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// RUBRIC TYPES
// ============================================

export type RubricCategory =
  | 'health'
  | 'time'
  | 'metabolic'
  | 'sleep'
  | 'productivity'
  | 'social'
  | 'custom';

export type ConstraintType = 'hard' | 'soft';

export type ValidationRuleType =
  | 'time_window'
  | 'no_overlap'
  | 'minimum_gap'
  | 'required_activity'
  | 'max_duration'
  | 'min_duration'
  | 'custom';

export interface TimeWindowRule {
  type: 'time_window';
  start: string; // HH:mm format
  end: string;
  activity?: string;
}

export interface NoOverlapRule {
  type: 'no_overlap';
  with: string; // e.g., "sleep_time", "meetings"
}

export interface MinimumGapRule {
  type: 'minimum_gap';
  between: string;
  and: string;
  hours: number;
}

export interface RequiredActivityRule {
  type: 'required_activity';
  activity: string;
  min_duration_minutes?: number;
}

export interface DurationRule {
  type: 'max_duration' | 'min_duration';
  activity: string;
  minutes: number;
}

export interface CustomRule {
  type: 'custom';
  function: string;
  params?: Record<string, unknown>;
}

export type ValidationRule =
  | TimeWindowRule
  | NoOverlapRule
  | MinimumGapRule
  | RequiredActivityRule
  | DurationRule
  | CustomRule;

export interface WorkflowRubric {
  id: string;
  workflow_id: string;
  user_id: string;
  category: RubricCategory;
  name: string;
  description?: string | null;
  constraint_type: ConstraintType;
  validation_rule: ValidationRule;
  weight: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// EXECUTION TYPES
// ============================================

export type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'awaiting_user'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface StepResult {
  step_index: number;
  step_type: WorkflowStepType;
  status: 'success' | 'failed' | 'skipped';
  data?: unknown;
  error?: string;
  started_at: string;
  completed_at?: string;
}

export interface RubricResult {
  rubric_id: string;
  name: string;
  category: RubricCategory;
  constraint_type: ConstraintType;
  passed: boolean;
  score: number; // 0-100
  message?: string;
  details?: unknown;
}

export interface RubricValidationResult {
  overall_score: number; // 0-100
  passed: boolean; // true if all hard constraints pass and score >= threshold
  hard_constraints_passed: boolean;
  soft_constraints_score: number;
  results: RubricResult[];
  suggestions?: string[];
}

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  user_id: string;
  status: ExecutionStatus;
  input_data?: Record<string, unknown> | null;
  current_step: number;
  step_results: StepResult[];
  rubric_results?: RubricValidationResult | null;
  output_data?: Record<string, unknown> | null;
  pending_proposal?: AgendaProposal | null;
  user_feedback: string[];
  iteration_count: number;
  error_message?: string | null;
  error_step?: number | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// AGENDA TYPES
// ============================================

export type AgendaItemStatus =
  | 'proposed'
  | 'approved'
  | 'synced'
  | 'completed'
  | 'skipped';

export type AgendaCategory =
  | 'META'
  | 'STARTUP'
  | 'HEDGE'
  | 'HEALTH'
  | 'SOCIAL'
  | 'ADMIN'
  | 'RECOVERY'
  | 'MEETING'
  | 'COMMUTE'
  | 'LEARNING'
  | 'WRITING'
  | 'ERRANDS';

export interface AgendaItem {
  id: string;
  execution_id?: string | null;
  user_id: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_time: string;
  title: string;
  description?: string | null;
  category?: AgendaCategory | null;
  pursuit_id?: string | null;
  subgoal_id?: string | null;
  intensity?: 'low' | 'medium' | 'high' | null;
  location?: string | null;
  google_event_id?: string | null;
  synced_at?: string | null;
  status: AgendaItemStatus;
  created_at: string;
  updated_at: string;
}

export interface AgendaProposal {
  date: string;
  items: AgendaItem[];
  rubric_score: number;
  rubric_details: RubricValidationResult;
  summary: string;
  suggestions?: string[];
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface CreateWorkflowRequest {
  name: string;
  slug: string;
  description?: string;
  steps?: WorkflowStep[];
  enabled_integrations?: string[];
  expected_output_format?: Record<string, unknown>;
  autonomous_schedule?: AutonomousSchedule;
}

export interface UpdateWorkflowRequest {
  name?: string;
  slug?: string;
  description?: string;
  is_active?: boolean;
  steps?: WorkflowStep[];
  enabled_integrations?: string[];
  expected_output_format?: Record<string, unknown>;
  autonomous_schedule?: AutonomousSchedule;
}

export interface CreateRubricRequest {
  workflow_id: string;
  category: RubricCategory;
  name: string;
  description?: string;
  constraint_type?: ConstraintType;
  validation_rule: ValidationRule;
  weight?: number;
}

export interface UpdateRubricRequest {
  category?: RubricCategory;
  name?: string;
  description?: string;
  constraint_type?: ConstraintType;
  validation_rule?: ValidationRule;
  weight?: number;
  is_active?: boolean;
}

export interface ExecuteWorkflowRequest {
  workflow_id?: string;
  workflow_slug?: string;
  input_data?: Record<string, unknown>;
  target_date?: string; // For /planmyday
}

export interface WorkflowFeedbackRequest {
  execution_id: string;
  feedback: string;
  action: 'approve' | 'reject' | 'iterate';
}

export interface AgendaApprovalRequest {
  execution_id: string;
  approved_items: string[]; // IDs of approved items
  modifications?: Array<{
    id: string;
    changes: Partial<AgendaItem>;
  }>;
  sync_to_calendar?: boolean;
}

// Response types
export interface WorkflowResponse {
  workflow: Workflow;
}

export interface WorkflowsResponse {
  workflows: Workflow[];
}

export interface RubricResponse {
  rubric: WorkflowRubric;
}

export interface RubricsResponse {
  rubrics: WorkflowRubric[];
}

export interface ExecutionResponse {
  execution: WorkflowExecution;
}

export interface ExecutionsResponse {
  executions: WorkflowExecution[];
}

export interface AgendaResponse {
  proposal: AgendaProposal;
}

export interface ErrorResponse {
  error: string;
  details?: unknown;
}

// ============================================
// PLANMYDAY SPECIFIC TYPES
// ============================================

export interface PlanMyDayInput {
  target_date: string;
  include_calendar?: boolean;
  include_memories?: boolean;
  include_pursuits?: boolean;
  custom_constraints?: string[];
}

export interface PlanMyDayContext {
  date: string;
  profile: {
    timezone: string;
    day_start_time: string;
    day_end_time: string;
    sleep_time: string;
    wake_time: string;
    caffeine_cutoff_hours: number;
    morning_sunlight_minutes: number;
    preferred_workout_time: string;
  };
  calendar_events: Array<{
    id: string;
    title: string;
    start: string;
    end: string;
    location?: string;
    is_all_day: boolean;
  }>;
  busy_slots: Array<{
    start: string;
    end: string;
  }>;
  pursuits: Array<{
    id: string;
    name: string;
    weekly_hours_target: number;
    hours_logged_this_week: number;
    status: string;
  }>;
  memories: Array<{
    id: string;
    content: string;
    type: string;
    importance: number;
  }>;
  rubrics: WorkflowRubric[];
}
