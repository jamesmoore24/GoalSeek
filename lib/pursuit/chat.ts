import { createClient } from "@/lib/supabase";
import type { PursuitChatContext, PursuitChatMessage } from "@/types/pursuit";

/**
 * Build complete context for pursuit chat
 */
export async function buildPursuitChatContext(
  userId: string,
  pursuitId: string,
  includeContextDocs: boolean = true
): Promise<PursuitChatContext> {
  const supabase = createClient();

  // Fetch all data in parallel
  const [pursuitRes, subgoalsRes, contextsRes] = await Promise.all([
    supabase
      .from("pursuits")
      .select("*")
      .eq("id", pursuitId)
      .eq("user_id", userId)
      .single(),
    supabase
      .from("subgoals")
      .select("*")
      .eq("pursuit_id", pursuitId)
      .eq("user_id", userId)
      .order("priority", { ascending: true }),
    includeContextDocs
      ? supabase
          .from("pursuit_context")
          .select("*")
          .eq("pursuit_id", pursuitId)
          .eq("user_id", userId)
          .order("uploaded_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (pursuitRes.error) {
    throw new Error(`Failed to fetch pursuit: ${pursuitRes.error.message}`);
  }

  // Fetch progress for this week
  const progressRes = await fetch(
    `/api/pursuits/${pursuitId}/progress`,
    { method: "GET" }
  );
  const { progress } = await progressRes.json();

  return {
    pursuit: pursuitRes.data,
    subgoals: subgoalsRes.data || [],
    executables: [], // TODO: Fetch if needed
    context_documents: contextsRes.data || [],
    weekly_progress: progress,
  };
}

/**
 * Format messages for pursuit chat with system prompt
 */
export function formatPursuitChatMessages(
  context: PursuitChatContext,
  messages: PursuitChatMessage[]
): any[] {
  const systemPrompt = buildSystemPrompt(context);

  return [
    { role: "system", content: systemPrompt },
    ...messages,
  ];
}

/**
 * Build system prompt for pursuit chat
 */
function buildSystemPrompt(context: PursuitChatContext): string {
  const { pursuit, subgoals, context_documents, weekly_progress } = context;

  const statusEmoji =
    weekly_progress.status === 'on_track' ? '🟢' :
    weekly_progress.status === 'ahead' ? '🔵' : '🔴';

  const contextDocsText = context_documents.length > 0
    ? `\n\n## Context Documents Available\n${context_documents.map(doc => {
        let text = `- ${doc.filename} (${doc.file_type})`;
        if (doc.content_text && doc.content_text.length > 0) {
          text += `\n  Preview: ${doc.content_text.substring(0, 200)}...`;
        }
        return text;
      }).join('\n')}`
    : '';

  const subgoalsText = subgoals.length > 0
    ? `\n\n## Existing Subgoals\n${subgoals.map((sg, idx) => {
        const milestoneCount = sg.intermediate_milestones?.length || 0;
        const milestonesCompleted = sg.intermediate_milestones?.filter((m: any) => m.completed).length || 0;
        return `${idx + 1}. **${sg.name}** (${sg.status})
   - Progress: ${milestonesCompleted}/${milestoneCount} milestones
   - Priority: ${sg.priority}
   ${sg.execution_strategy ? `- Strategy: ${sg.execution_strategy.substring(0, 100)}...` : ''}`;
      }).join('\n')}`
    : '\n\n## Existing Subgoals\nNone yet. You can create SMART subgoals with execution strategies.';

  return `You are managing the "${pursuit.name}" pursuit for the user.

## Current Status
- Weekly target: ${pursuit.weekly_hours_target} hours
- Progress this week: ${statusEmoji} ${weekly_progress.hours_logged}h / ${weekly_progress.hours_target}h (${weekly_progress.progress_percentage.toFixed(0)}%)
- Status: ${weekly_progress.status.toUpperCase()}
- Description: ${pursuit.description || 'No description'}
${pursuit.deadline ? `- Deadline: ${new Date(pursuit.deadline).toLocaleDateString()}` : ''}
${subgoalsText}
${contextDocsText}

## Your Capabilities

You are an expert strategic planner and execution coach. Your role is to help the user:

1. **Create SMART Subgoals**: Break down the pursuit into time-boxed, achievable subgoals with:
   - Specific, Measurable, Achievable, Relevant, Timebound criteria
   - Clear execution strategy
   - Daily and per-session deliverables
   - Intermediate milestones

2. **Analyze Context**: Review uploaded documents (PDFs, images, term sheets) to inform goal structure and priorities

3. **Adjust Strategy**: Based on new information, reorder priorities, update execution strategies, or restructure subgoals

4. **Track Progress**: Monitor milestone completion and suggest adjustments based on progress

## Guidelines

- **Be specific**: Vague goals like "work on startup" should become "Complete MVP user authentication flow by Friday"
- **Use SMART criteria**: Every subgoal should have clear success criteria
- **Break it down**: Large goals need intermediate milestones
- **Suggest deliverables**: Tell the user what to accomplish daily and per work session
- **Be adaptive**: If the user shares new information (term sheets, feedback, blockers), adjust the plan accordingly

## Function Calling

Use the available functions to make changes:
- \`create_subgoal\`: Add new subgoals with full SMART criteria
- \`update_subgoal\`: Modify existing subgoals, add milestones, change status
- \`update_pursuit\`: Change weekly hours target, deadline, or description
- \`delete_subgoal\`: Remove subgoals that are no longer relevant
- \`reorder_subgoals\`: Adjust priorities based on urgency/importance

**Important**: Always confirm with the user before making changes. Present your recommendations, explain the reasoning, and wait for confirmation before calling functions.

## Conversation Style

- Be conversational but professional
- Ask clarifying questions when needed
- Explain your reasoning when suggesting changes
- Celebrate progress and milestones
- Be honest about challenges and suggest solutions`;
}
