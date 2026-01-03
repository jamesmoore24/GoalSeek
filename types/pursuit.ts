// ============================================
// PURSUIT SYSTEM TYPES
// ============================================

// Base types
export interface Pursuit {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  color: string;
  icon_name?: string | null;
  weekly_hours_target: number;
  deadline?: string | null;
  status: 'active' | 'paused' | 'completed' | 'archived';
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface SmartCriteria {
  specific: string;
  measurable: string;
  achievable: string;
  relevant: string;
  timebound: string;
}

export interface Milestone {
  name: string;
  completed: boolean;
  completed_at?: string | null;
}

export interface Subgoal {
  id: string;
  pursuit_id: string;
  user_id: string;
  name: string;
  description?: string | null;
  smart_criteria: SmartCriteria;
  execution_strategy?: string | null;
  daily_deliverable?: string | null;
  session_deliverable?: string | null;
  intermediate_milestones: Milestone[];
  deadline?: string | null;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  priority: number;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Executable {
  id: string;
  subgoal_id: string;
  user_id: string;
  title: string;
  description?: string | null;
  estimated_minutes?: number | null;
  priority: number;
  completed: boolean;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PursuitContext {
  id: string;
  pursuit_id: string;
  user_id: string;
  filename: string;
  file_type: 'pdf' | 'image' | 'text' | 'url';
  mime_type?: string | null;
  file_size_bytes?: number | null;
  storage_path: string;
  content_text?: string | null;
  content_summary?: string | null;
  uploaded_at: string;
  last_accessed_at?: string | null;
}

// Progress tracking
export interface PursuitProgress {
  pursuit_id: string;
  week_start: string;
  hours_logged: number;
  hours_target: number;
  progress_percentage: number;
  status: 'on_track' | 'behind' | 'ahead';
  recent_logs: Array<{
    date: string;
    hours: number;
    tag: string;
  }>;
}

export interface SubgoalProgress {
  subgoal_id: string;
  milestones_completed: number;
  milestones_total: number;
  days_until_deadline?: number | null;
  is_overdue: boolean;
}

// API Request/Response types
export interface CreatePursuitRequest {
  name: string;
  description?: string;
  color?: string;
  icon_name?: string;
  weekly_hours_target?: number;
  deadline?: string;
  priority?: number;
}

export interface UpdatePursuitRequest {
  name?: string;
  description?: string;
  color?: string;
  icon_name?: string;
  weekly_hours_target?: number;
  deadline?: string;
  status?: 'active' | 'paused' | 'completed' | 'archived';
  priority?: number;
}

export interface CreateSubgoalRequest {
  name: string;
  description?: string;
  smart_criteria?: Partial<SmartCriteria>;
  execution_strategy?: string;
  daily_deliverable?: string;
  session_deliverable?: string;
  deadline?: string;
  priority?: number;
}

export interface UpdateSubgoalRequest {
  name?: string;
  description?: string;
  smart_criteria?: Partial<SmartCriteria>;
  execution_strategy?: string;
  daily_deliverable?: string;
  session_deliverable?: string;
  intermediate_milestones?: Milestone[];
  deadline?: string;
  status?: 'active' | 'paused' | 'completed' | 'cancelled';
  priority?: number;
}

export interface CreateExecutableRequest {
  title: string;
  description?: string;
  estimated_minutes?: number;
  priority?: number;
}

export interface UpdateExecutableRequest {
  title?: string;
  description?: string;
  estimated_minutes?: number;
  priority?: number;
  completed?: boolean;
}

export interface UploadContextRequest {
  filename: string;
  file_type: 'pdf' | 'image' | 'text' | 'url';
  content_base64?: string; // For direct uploads
  url?: string; // For URL imports
}

// LLM Function Calling Schema
export interface PursuitChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface PursuitChatContext {
  pursuit: Pursuit;
  subgoals: Subgoal[];
  executables: Executable[];
  context_documents: PursuitContext[];
  weekly_progress: PursuitProgress;
}

// Function calling types for LLM
export type PursuitFunction =
  | 'update_pursuit'
  | 'create_subgoal'
  | 'update_subgoal'
  | 'delete_subgoal'
  | 'reorder_subgoals'
  | 'create_executable'
  | 'update_executable'
  | 'delete_executable';

export interface FunctionCall {
  name: PursuitFunction;
  arguments: Record<string, any>;
}

// API Response types
export interface PursuitsResponse {
  pursuits: Pursuit[];
}

export interface PursuitResponse {
  pursuit: Pursuit;
}

export interface SubgoalsResponse {
  subgoals: Subgoal[];
}

export interface SubgoalResponse {
  subgoal: Subgoal;
}

export interface ExecutablesResponse {
  executables: Executable[];
}

export interface ExecutableResponse {
  executable: Executable;
}

export interface ProgressResponse {
  progress: PursuitProgress;
}

export interface ContextsResponse {
  contexts: PursuitContext[];
}

export interface ContextResponse {
  context: PursuitContext;
}

export interface ErrorResponse {
  error: string;
  details?: any;
}
