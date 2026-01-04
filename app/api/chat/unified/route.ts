import { NextResponse } from "next/server";
import { getOpenRouterInstance, PLAN_MODEL } from "@/app/lib/openai";
import { executePursuitFunction, getPursuitFunctionDefinitions } from "@/lib/pursuit/functions";
import { createClient } from "@/lib/supabase";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { embedText, formatEmbeddingForPgvector } from "@/lib/embeddings";
import {
  getGoogleCalendarEvents,
  getFreeBusyTime,
  formatCalendarForLLM,
  formatBusySlots,
  type GoogleCalendarEvent,
} from "@/lib/google-calendar";

// Check Garmin config inline to avoid importing garmin-connect library at module level
function isGarminConfigured(): boolean {
  return !!(process.env.GARMIN_EMAIL && process.env.GARMIN_PASSWORD);
}

/**
 * POST /api/chat/unified - Unified chat with full pursuit context
 * Request body:
 *   - selected_pursuit_id?: string (optional - for focused context)
 *   - messages: Array<{role, content}>
 *   - include_all_pursuits: boolean (default: true)
 */
export async function POST(request: Request) {
  try {
    // Get authenticated user
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = user.id;

    const { selected_pursuit_id, messages, include_all_pursuits = true } = await request.json();

    if (!Array.isArray(messages)) {
      return NextResponse.json(
        { error: "messages array is required" },
        { status: 400 }
      );
    }

    // Get the latest user message for semantic memory search
    const latestUserMessage = messages
      .filter((m: any) => m.role === 'user')
      .map((m: any) => typeof m.content === 'string' ? m.content : m.content?.find((c: any) => c.type === 'text')?.text || '')
      .pop() || '';

    // Build comprehensive context with semantic memory retrieval
    const context = await buildUnifiedChatContext(
      userId,
      selected_pursuit_id,
      include_all_pursuits,
      latestUserMessage
    );

    // Format messages with unified context
    const formattedMessages = formatUnifiedChatMessages(context, messages);

    // Debug: log if images are being sent
    const hasImages = messages.some((m: any) =>
      Array.isArray(m.content) && m.content.some((c: any) => c.type === 'image_url')
    );
    if (hasImages) {
      console.log('[Unified Chat] Multimodal request detected - sending images to Gemini');
    }

    const openRouter = getOpenRouterInstance();

    // Call with function calling enabled
    const response = await openRouter.chat.completions.create({
      model: PLAN_MODEL,
      messages: formattedMessages as any,
      tools: getPursuitFunctionDefinitions(),
      tool_choice: "auto",
      temperature: 0.7,
      stream: true,
    });

    // Create streaming response
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        let contentBuffer = "";
        let functionCalls: any[] = [];

        try {
          for await (const chunk of response) {
            const delta = chunk.choices[0]?.delta;

            // Handle tool calls
            if (delta?.tool_calls) {
              for (const toolCall of delta.tool_calls) {
                if (toolCall.index !== undefined) {
                  // New tool call or continuing existing one
                  if (!functionCalls[toolCall.index]) {
                    functionCalls[toolCall.index] = {
                      id: toolCall.id || '',
                      type: 'function',
                      function: {
                        name: toolCall.function?.name || '',
                        arguments: toolCall.function?.arguments || '',
                      },
                    };
                  } else {
                    // Append to existing tool call
                    if (toolCall.function?.name) {
                      functionCalls[toolCall.index].function.name += toolCall.function.name;
                    }
                    if (toolCall.function?.arguments) {
                      functionCalls[toolCall.index].function.arguments += toolCall.function.arguments;
                    }
                  }
                }
              }
            }

            // Handle content
            const text = delta?.content || "";
            if (text) {
              contentBuffer += text;
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    type: "content",
                    content: text,
                  }) + "\n"
                )
              );
            }

            // Check if we're done
            if (chunk.choices[0]?.finish_reason === "tool_calls") {
              // Execute function calls
              for (const call of functionCalls) {
                if (call && call.function && call.function.name && call.function.arguments) {
                  try {
                    const args = JSON.parse(call.function.arguments);
                    const result = await executePursuitFunction(
                      userId,
                      call.function.name,
                      args
                    );

                    controller.enqueue(
                      encoder.encode(
                        JSON.stringify({
                          type: "function_result",
                          function: call.function.name,
                          arguments: args,
                          result,
                        }) + "\n"
                      )
                    );
                  } catch (error) {
                    console.error("Error executing function:", error);
                    controller.enqueue(
                      encoder.encode(
                        JSON.stringify({
                          type: "function_error",
                          function: call.function.name,
                          error: error instanceof Error ? error.message : "Function execution failed",
                        }) + "\n"
                      )
                    );
                  }
                }
              }
            }
          }

          controller.close();
        } catch (error) {
          console.error("Streaming error:", error);
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "error",
                error: error instanceof Error ? error.message : "Stream failed",
              }) + "\n"
            )
          );
          controller.close();
        }
      },
    });

    return new NextResponse(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("Unified chat error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Build comprehensive context for unified chat
 */
async function buildUnifiedChatContext(
  userId: string,
  selectedPursuitId?: string,
  includeAllPursuits: boolean = true,
  userMessage: string = ''
) {
  const supabase = createClient();

  // Fetch memories using semantic search if we have a user message
  let memories: any[] = [];
  if (userMessage && userMessage.length > 10) {
    try {
      // Embed the user message for semantic search
      const queryEmbedding = await embedText(userMessage);

      // Use the search_memories function for semantic retrieval
      const { data, error } = await supabase.rpc("search_memories", {
        query_embedding: formatEmbeddingForPgvector(queryEmbedding),
        match_user_id: userId,
        match_threshold: 0.5, // Lower threshold to get more context
        match_count: 10,
      });

      if (!error && data) {
        memories = data;
        console.log(`[RAG] Found ${memories.length} relevant memories via semantic search`);
      }
    } catch (error) {
      console.error('[RAG] Semantic search failed, falling back to recent:', error);
    }
  }

  // Fallback to recent memories if semantic search returned nothing or failed
  if (memories.length === 0) {
    const memoriesRes = await supabase
      .from("user_memories")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    memories = memoriesRes.data || [];
  }

  // Fetch all active pursuits with their progress
  const pursuitsRes = await supabase
    .from("pursuits")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("priority", { ascending: true });

  if (pursuitsRes.error) {
    throw new Error(`Failed to fetch pursuits: ${pursuitsRes.error.message}`);
  }

  const pursuits = pursuitsRes.data || [];

  // Fetch progress for all pursuits
  const progressMap = new Map();
  await Promise.all(
    pursuits.map(async (pursuit) => {
      try {
        // Calculate progress inline instead of calling API endpoint
        const weekStart = getWeekStart();
        const { data: logs } = await supabase
          .from("day_logs")
          .select("duration_minutes")
          .eq("user_id", userId)
          .eq("pursuit_id", pursuit.id)
          .gte("created_at", weekStart.toISOString());

        const hoursLogged = (logs || []).reduce((sum, log) => sum + (log.duration_minutes || 0), 0) / 60;
        const progressPercentage = pursuit.weekly_hours_target > 0
          ? (hoursLogged / pursuit.weekly_hours_target) * 100
          : 0;

        const status = progressPercentage >= 90 && progressPercentage <= 110
          ? 'on_track'
          : progressPercentage > 110
          ? 'ahead'
          : 'behind';

        progressMap.set(pursuit.id, {
          pursuit_id: pursuit.id,
          week_start: weekStart.toISOString(),
          hours_logged: hoursLogged,
          hours_target: pursuit.weekly_hours_target,
          progress_percentage: progressPercentage,
          status,
        });
      } catch (error) {
        console.error(`Failed to calculate progress for ${pursuit.id}:`, error);
      }
    })
  );

  // If a specific pursuit is selected, fetch its subgoals
  let selectedPursuit = null;
  let subgoals = [];
  if (selectedPursuitId) {
    selectedPursuit = pursuits.find(p => p.id === selectedPursuitId);

    if (selectedPursuit) {
      const subgoalsRes = await supabase
        .from("subgoals")
        .select("*")
        .eq("pursuit_id", selectedPursuitId)
        .eq("user_id", userId)
        .order("priority", { ascending: true });

      subgoals = subgoalsRes.data || [];
    }
  }

  // Fetch calendar events for the next 7 days if calendar is connected
  let calendarEvents: GoogleCalendarEvent[] = [];
  let busySlots: Array<{ start: Date; end: Date }> = [];
  let calendarSettings: { shareTitles: boolean; shareDescriptions: boolean } | null = null;

  try {
    const now = new Date();
    const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Check if user has calendar connected and get their settings
    const { data: integration } = await supabase
      .from('user_integrations')
      .select('google_calendar_connected, calendar_sync_enabled, share_event_titles, share_event_descriptions')
      .eq('user_id', userId)
      .single();

    if (integration?.google_calendar_connected && integration?.calendar_sync_enabled) {
      calendarSettings = {
        shareTitles: integration.share_event_titles ?? true,
        shareDescriptions: integration.share_event_descriptions ?? false,
      };

      const [events, busy] = await Promise.all([
        getGoogleCalendarEvents(userId, { startDate: now, endDate }),
        getFreeBusyTime(userId, now, endDate),
      ]);

      calendarEvents = events;
      busySlots = busy;

      console.log(`[Calendar] Fetched ${calendarEvents.length} events and ${busySlots.length} busy slots`);
    }
  } catch (error) {
    console.error('[Calendar] Failed to fetch calendar data:', error);
  }

  // Fetch Garmin wellness data (if configured via env vars, dynamically import to avoid bundling)
  let garminData: {
    sleep: unknown;
    heartRate: unknown;
    daily: unknown;
    activities: unknown[];
  } | null = null;
  let formatGarminForLLM: ((data: any) => string) | null = null;
  try {
    if (isGarminConfigured()) {
      const garmin = await import("@/lib/garmin");
      garminData = await garmin.getGarminWellnessSummary();
      formatGarminForLLM = garmin.formatGarminForLLM;
      console.log(`[Fitness] Fetched Garmin wellness data`);
    }
  } catch (error) {
    console.error('[Fitness] Failed to fetch Garmin data:', error);
  }

  return {
    all_pursuits: pursuits,
    progress_map: progressMap,
    selected_pursuit: selectedPursuit,
    selected_pursuit_subgoals: subgoals,
    memories,
    calendar_events: calendarEvents,
    busy_slots: busySlots,
    calendar_settings: calendarSettings,
    garmin_data: garminData,
    formatGarminForLLM,
  };
}

/**
 * Format messages for unified chat with system prompt
 */
function formatUnifiedChatMessages(context: any, messages: any[]): any[] {
  const systemPrompt = buildUnifiedSystemPrompt(context);

  return [
    { role: "system", content: systemPrompt },
    ...messages,
  ];
}

/**
 * Build system prompt for unified chat with full context
 */
function buildUnifiedSystemPrompt(context: any): string {
  const { all_pursuits, progress_map, selected_pursuit, selected_pursuit_subgoals, memories, calendar_events, busy_slots, calendar_settings, garmin_data, formatGarminForLLM } = context;

  // Build pursuit status overview
  const pursuitOverview = all_pursuits.map((pursuit: any) => {
    const progress = progress_map.get(pursuit.id);
    const statusEmoji =
      progress?.status === 'on_track' ? '🟢' :
      progress?.status === 'ahead' ? '🔵' : '🔴';

    return `  ${statusEmoji} **${pursuit.name}**: ${progress?.hours_logged.toFixed(1) || 0}h / ${pursuit.weekly_hours_target}h (${progress?.progress_percentage.toFixed(0) || 0}%)`;
  }).join('\n');

  // Build focused pursuit section if selected
  const focusedSection = selected_pursuit
    ? `\n\n## Currently Focused: ${selected_pursuit.name}

- Description: ${selected_pursuit.description || 'No description'}
- Weekly target: ${selected_pursuit.weekly_hours_target} hours
${selected_pursuit.deadline ? `- Deadline: ${new Date(selected_pursuit.deadline).toLocaleDateString()}` : ''}

### Existing Subgoals for ${selected_pursuit.name}
${selected_pursuit_subgoals.length > 0
  ? selected_pursuit_subgoals.map((sg: any, idx: number) => {
      const milestoneCount = sg.intermediate_milestones?.length || 0;
      const milestonesCompleted = sg.intermediate_milestones?.filter((m: any) => m.completed).length || 0;
      return `${idx + 1}. **${sg.name}** (${sg.status})
   - Progress: ${milestonesCompleted}/${milestoneCount} milestones
   - Priority: ${sg.priority}
   ${sg.execution_strategy ? `- Strategy: ${sg.execution_strategy.substring(0, 100)}...` : ''}`;
    }).join('\n')
  : 'None yet. You can create SMART subgoals for this pursuit.'}
`
    : '\n\nNo specific pursuit selected. You can help the user manage all pursuits or ask them to select one.';

  // Build memories section (with similarity scores if from semantic search)
  const memoriesSection = memories && memories.length > 0
    ? `\n\n## Relevant Memories (for context)
These memories are retrieved based on relevance to your current conversation:

${memories.map((m: any) => {
  const similarity = m.similarity ? ` (${(m.similarity * 100).toFixed(0)}% relevant)` : '';
  const type = m.memory_type ? `[${m.memory_type}]` : '';
  return `- ${type}${similarity} ${m.content}`;
}).join('\n')}`
    : '';

  // Build calendar section if calendar is connected
  const calendarSection = calendar_settings && calendar_events
    ? `\n\n## Your Calendar (Next 7 Days)

${formatCalendarForLLM(calendar_events, calendar_settings)}

### Busy Slots
${formatBusySlots(busy_slots)}

Use this calendar context to:
- Avoid scheduling during existing events
- Suggest optimal times for pursuit work sessions
- Identify open blocks for focused work
- Consider meeting preparation and transition time`
    : '';

  // Build fitness section if Garmin is connected
  const hasGarminData = garmin_data && (garmin_data.sleep || garmin_data.daily || garmin_data.heartRate || garmin_data.activities?.length > 0);

  let fitnessSection = '';
  if (hasGarminData && formatGarminForLLM) {
    fitnessSection = `\n\n## Fitness & Wellness Data (Garmin)

${formatGarminForLLM(garmin_data)}

Use this fitness context to:
- Consider recovery needs based on sleep quality and Body Battery
- Suggest lighter cognitive work if sleep was poor or Body Battery is low
- Factor in recent training load when planning intense activities
- Celebrate fitness consistency or suggest getting moving if inactive`;
  }

  return `You are an AI assistant helping the user manage their pursuits (goals) with full context awareness.

## All Active Pursuits - Weekly Progress

${pursuitOverview}
${focusedSection}
${memoriesSection}
${calendarSection}
${fitnessSection}

## Your Capabilities

You have **full context** on all pursuits and can:

1. **Manage Individual Pursuits**: Create/update/delete subgoals for the selected pursuit with:
   - SMART criteria (Specific, Measurable, Achievable, Relevant, Timebound)
   - Clear execution strategies
   - Daily and per-session deliverables
   - Intermediate milestones

2. **Cross-Pursuit Analysis**: Compare progress across all pursuits and suggest rebalancing:
   - Identify which pursuits are behind/ahead
   - Recommend shifting hours between pursuits
   - Alert when overall weekly hours are unbalanced

3. **Strategic Planning**: Help the user prioritize work across all goals:
   - Suggest which pursuit needs attention based on deadlines and progress
   - Recommend subgoal adjustments based on overall context
   - Identify conflicts or over-commitments

4. **Progress Tracking**: Monitor weekly progress and suggest adjustments:
   - Celebrate wins when pursuits are on track
   - Alert when falling behind
   - Suggest recovery strategies

## Guidelines

- **Be context-aware**: Use the full pursuit overview to give holistic advice
- **Be specific**: Transform vague goals into actionable SMART subgoals
- **Break it down**: Large goals need intermediate milestones
- **Suggest deliverables**: Tell the user what to accomplish daily and per session
- **Rebalance when needed**: If one pursuit is way behind, suggest adjusting time allocation
- **Confirm before changes**: Always explain your recommendations and wait for user confirmation before calling functions

## Function Calling

Use available functions to make changes:
- \`create_subgoal\`: Add subgoals to pursuits
- \`update_subgoal\`: Modify subgoals, add milestones, change status
- \`update_pursuit\`: Change weekly hours target, deadline, or description
- \`delete_subgoal\`: Remove irrelevant subgoals
- \`reorder_subgoals\`: Adjust priorities

**Important**: Present recommendations first, explain reasoning, then wait for confirmation before executing functions.

## Conversation Style

- Be conversational but professional
- Use the pursuit status emojis (🟢🔵🔴) when referencing specific pursuits
- Ask clarifying questions when needed
- Celebrate progress and milestones
- Be honest about challenges and suggest solutions
- Focus on helping the user achieve their goals efficiently`;
}

/**
 * Get the start of the current week (Monday)
 */
function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}
