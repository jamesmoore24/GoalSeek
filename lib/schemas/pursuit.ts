import { z } from 'zod';

// ============================================
// PURSUIT SYSTEM ZOD SCHEMAS
// ============================================

// Smart criteria schema
export const SmartCriteriaSchema = z.object({
  specific: z.string().max(500).default(''),
  measurable: z.string().max(500).default(''),
  achievable: z.string().max(500).default(''),
  relevant: z.string().max(500).default(''),
  timebound: z.string().max(500).default(''),
});

// Milestone schema
export const MilestoneSchema = z.object({
  name: z.string().min(1).max(200),
  completed: z.boolean(),
  completed_at: z.string().datetime().optional().nullable(),
});

// ============================================
// PURSUIT SCHEMAS
// ============================================

export const CreatePursuitSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(1000).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').optional().default('#3b82f6'),
  icon_name: z.string().max(50).optional(),
  weekly_hours_target: z.number().min(0).max(168).optional().default(0),
  deadline: z.string().datetime().optional(),
  priority: z.number().int().min(1).max(1000).optional().default(100),
});

export const UpdatePursuitSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon_name: z.string().max(50).optional().nullable(),
  weekly_hours_target: z.number().min(0).max(168).optional(),
  deadline: z.string().datetime().optional().nullable(),
  status: z.enum(['active', 'paused', 'completed', 'archived']).optional(),
  priority: z.number().int().min(1).max(1000).optional(),
});

// ============================================
// SUBGOAL SCHEMAS
// ============================================

export const CreateSubgoalSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name too long'),
  description: z.string().max(2000).optional(),
  smart_criteria: SmartCriteriaSchema.partial().optional(),
  execution_strategy: z.string().max(2000).optional(),
  daily_deliverable: z.string().max(500).optional(),
  session_deliverable: z.string().max(500).optional(),
  deadline: z.string().datetime().optional(),
  priority: z.number().int().min(1).max(1000).optional().default(100),
});

export const UpdateSubgoalSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  smart_criteria: SmartCriteriaSchema.partial().optional(),
  execution_strategy: z.string().max(2000).optional().nullable(),
  daily_deliverable: z.string().max(500).optional().nullable(),
  session_deliverable: z.string().max(500).optional().nullable(),
  intermediate_milestones: z.array(MilestoneSchema).optional(),
  deadline: z.string().datetime().optional().nullable(),
  status: z.enum(['active', 'paused', 'completed', 'cancelled']).optional(),
  priority: z.number().int().min(1).max(1000).optional(),
});

// ============================================
// EXECUTABLE SCHEMAS
// ============================================

export const CreateExecutableSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(1000).optional(),
  estimated_minutes: z.number().int().min(1).max(480).optional(),
  priority: z.number().int().min(1).max(1000).optional().default(100),
});

export const UpdateExecutableSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  estimated_minutes: z.number().int().min(1).max(480).optional().nullable(),
  priority: z.number().int().min(1).max(1000).optional(),
  completed: z.boolean().optional(),
});

// ============================================
// CONTEXT UPLOAD SCHEMA
// ============================================

export const UploadContextSchema = z.object({
  filename: z.string().min(1).max(255),
  file_type: z.enum(['pdf', 'image', 'text', 'url']),
  content_base64: z.string().optional(), // For direct uploads
  url: z.string().url().optional(), // For URL imports
}).refine(
  (data) => data.content_base64 || data.url,
  { message: "Either content_base64 or url must be provided" }
);

// ============================================
// FUNCTION CALLING SCHEMAS FOR LLM
// ============================================

export const UpdatePursuitFunctionSchema = z.object({
  pursuit_id: z.string().uuid(),
  updates: UpdatePursuitSchema,
});

export const CreateSubgoalFunctionSchema = z.object({
  pursuit_id: z.string().uuid(),
  subgoal: CreateSubgoalSchema,
});

export const UpdateSubgoalFunctionSchema = z.object({
  subgoal_id: z.string().uuid(),
  updates: UpdateSubgoalSchema,
});

export const DeleteSubgoalFunctionSchema = z.object({
  subgoal_id: z.string().uuid(),
});

export const ReorderSubgoalsFunctionSchema = z.object({
  pursuit_id: z.string().uuid(),
  subgoal_order: z.array(z.object({
    subgoal_id: z.string().uuid(),
    priority: z.number().int().min(1).max(1000),
  })),
});

export const CreateExecutableFunctionSchema = z.object({
  subgoal_id: z.string().uuid(),
  executable: CreateExecutableSchema,
});

export const UpdateExecutableFunctionSchema = z.object({
  executable_id: z.string().uuid(),
  updates: UpdateExecutableSchema,
});

export const DeleteExecutableFunctionSchema = z.object({
  executable_id: z.string().uuid(),
});
