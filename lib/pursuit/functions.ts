import { createClient } from "@/lib/supabase";
import type { PursuitFunction } from "@/types/pursuit";
import { createCalendarEvent } from "@/lib/google-calendar";

/**
 * Execute LLM function calls for pursuit management
 */
export async function executePursuitFunction(
  userId: string,
  functionName: PursuitFunction,
  args: any
): Promise<any> {
  const supabase = createClient();

  try {
    switch (functionName) {
      case "update_pursuit": {
        const { pursuit_id, updates } = args;

        const { data, error } = await supabase
          .from("pursuits")
          .update(updates)
          .eq("id", pursuit_id)
          .eq("user_id", userId)
          .select()
          .single();

        if (error) throw error;

        return {
          success: true,
          pursuit: data,
          message: `Updated pursuit: ${data.name}`
        };
      }

      case "create_subgoal": {
        const { pursuit_id, name, description, smart_criteria, execution_strategy, daily_deliverable, session_deliverable, deadline, priority } = args;

        const { data, error } = await supabase
          .from("subgoals")
          .insert({
            pursuit_id,
            user_id: userId,
            name,
            description,
            smart_criteria: smart_criteria || {
              specific: "",
              measurable: "",
              achievable: "",
              relevant: "",
              timebound: ""
            },
            execution_strategy,
            daily_deliverable,
            session_deliverable,
            deadline,
            priority: priority || 100,
          })
          .select()
          .single();

        if (error) throw error;

        return {
          success: true,
          subgoal: data,
          message: `Created subgoal: ${data.name}`
        };
      }

      case "update_subgoal": {
        const { subgoal_id, updates } = args;

        // If completing the subgoal, set completed_at
        if (updates.status === 'completed' && !updates.completed_at) {
          updates.completed_at = new Date().toISOString();
        }

        const { data, error } = await supabase
          .from("subgoals")
          .update(updates)
          .eq("id", subgoal_id)
          .eq("user_id", userId)
          .select()
          .single();

        if (error) throw error;

        return {
          success: true,
          subgoal: data,
          message: `Updated subgoal: ${data.name}`
        };
      }

      case "delete_subgoal": {
        const { subgoal_id } = args;

        // Get subgoal name before deleting
        const { data: subgoal } = await supabase
          .from("subgoals")
          .select("name")
          .eq("id", subgoal_id)
          .eq("user_id", userId)
          .single();

        const { error } = await supabase
          .from("subgoals")
          .delete()
          .eq("id", subgoal_id)
          .eq("user_id", userId);

        if (error) throw error;

        return {
          success: true,
          message: `Deleted subgoal: ${subgoal?.name || subgoal_id}`
        };
      }

      case "reorder_subgoals": {
        const { pursuit_id, subgoal_order } = args;

        // Batch update priorities
        const promises = subgoal_order.map((item: { subgoal_id: string; priority: number }) =>
          supabase
            .from("subgoals")
            .update({ priority: item.priority })
            .eq("id", item.subgoal_id)
            .eq("user_id", userId)
        );

        await Promise.all(promises);

        return {
          success: true,
          message: `Reordered ${subgoal_order.length} subgoals`
        };
      }

      case "create_executable": {
        const { subgoal_id, title, description, estimated_minutes, priority } = args;

        const { data, error } = await supabase
          .from("executables")
          .insert({
            subgoal_id,
            user_id: userId,
            title,
            description,
            estimated_minutes,
            priority: priority || 100,
          })
          .select()
          .single();

        if (error) throw error;

        return {
          success: true,
          executable: data,
          message: `Created task: ${data.title}`
        };
      }

      case "update_executable": {
        const { executable_id, updates } = args;

        // If completing the executable, set completed_at
        if (updates.completed && !updates.completed_at) {
          updates.completed_at = new Date().toISOString();
        }

        const { data, error } = await supabase
          .from("executables")
          .update(updates)
          .eq("id", executable_id)
          .eq("user_id", userId)
          .select()
          .single();

        if (error) throw error;

        return {
          success: true,
          executable: data,
          message: `Updated task: ${data.title}`
        };
      }

      case "delete_executable": {
        const { executable_id } = args;

        // Get executable title before deleting
        const { data: executable } = await supabase
          .from("executables")
          .select("title")
          .eq("id", executable_id)
          .eq("user_id", userId)
          .single();

        const { error } = await supabase
          .from("executables")
          .delete()
          .eq("id", executable_id)
          .eq("user_id", userId);

        if (error) throw error;

        return {
          success: true,
          message: `Deleted task: ${executable?.title || executable_id}`
        };
      }

      case "create_calendar_event": {
        const { title, start_time, end_time, description, location } = args;

        const event = await createCalendarEvent(userId, {
          title,
          startTime: new Date(start_time),
          endTime: new Date(end_time),
          description,
          location,
        });

        if (!event) {
          throw new Error("Failed to create calendar event");
        }

        return {
          success: true,
          event: {
            id: event.id,
            title: event.title,
            start: event.start.toISOString(),
            end: event.end.toISOString(),
            link: event.htmlLink,
          },
          message: `Created calendar event: "${event.title}" on ${event.start.toLocaleDateString()}`
        };
      }

      default:
        throw new Error(`Unknown function: ${functionName}`);
    }
  } catch (error: any) {
    console.error(`Error executing ${functionName}:`, error);
    return {
      success: false,
      error: error.message || "Function execution failed"
    };
  }
}

/**
 * Get function definitions for LLM
 */
export function getPursuitFunctionDefinitions() {
  return [
    {
      type: "function" as const,
      function: {
        name: "update_pursuit",
        description: "Update pursuit details like name, description, weekly hours target, deadline, or color",
        parameters: {
          type: "object",
          properties: {
            pursuit_id: { type: "string", description: "UUID of the pursuit" },
            updates: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                weekly_hours_target: { type: "number", minimum: 0, maximum: 168 },
                deadline: { type: "string", format: "date-time" },
                color: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
              },
            },
          },
          required: ["pursuit_id", "updates"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "create_subgoal",
        description: "Create a new subgoal for the pursuit with SMART criteria and execution strategy",
        parameters: {
          type: "object",
          properties: {
            pursuit_id: { type: "string", description: "UUID of the pursuit" },
            name: { type: "string", description: "Name of the subgoal" },
            description: { type: "string" },
            smart_criteria: {
              type: "object",
              properties: {
                specific: { type: "string" },
                measurable: { type: "string" },
                achievable: { type: "string" },
                relevant: { type: "string" },
                timebound: { type: "string" },
              },
            },
            execution_strategy: { type: "string", description: "How to approach this subgoal" },
            daily_deliverable: { type: "string", description: "What to accomplish each day" },
            session_deliverable: { type: "string", description: "What to accomplish per work session" },
            deadline: { type: "string", format: "date-time" },
            priority: { type: "number", description: "Lower number = higher priority" },
          },
          required: ["pursuit_id", "name"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "update_subgoal",
        description: "Update an existing subgoal's details, milestones, or status",
        parameters: {
          type: "object",
          properties: {
            subgoal_id: { type: "string", description: "UUID of the subgoal" },
            updates: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                smart_criteria: {
                  type: "object",
                  properties: {
                    specific: { type: "string" },
                    measurable: { type: "string" },
                    achievable: { type: "string" },
                    relevant: { type: "string" },
                    timebound: { type: "string" },
                  },
                },
                execution_strategy: { type: "string" },
                daily_deliverable: { type: "string" },
                session_deliverable: { type: "string" },
                intermediate_milestones: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      completed: { type: "boolean" },
                      completed_at: { type: "string", format: "date-time" },
                    },
                    required: ["name", "completed"],
                  },
                },
                status: { type: "string", enum: ["active", "paused", "completed", "cancelled"] },
              },
            },
          },
          required: ["subgoal_id", "updates"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "delete_subgoal",
        description: "Delete a subgoal and all its executables",
        parameters: {
          type: "object",
          properties: {
            subgoal_id: { type: "string", description: "UUID of the subgoal to delete" },
          },
          required: ["subgoal_id"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "reorder_subgoals",
        description: "Reorder subgoals by priority (lower number = higher priority)",
        parameters: {
          type: "object",
          properties: {
            pursuit_id: { type: "string" },
            subgoal_order: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  subgoal_id: { type: "string" },
                  priority: { type: "number" },
                },
                required: ["subgoal_id", "priority"],
              },
            },
          },
          required: ["pursuit_id", "subgoal_order"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "create_calendar_event",
        description: "Create a new event on the user's Google Calendar. Use this to schedule time blocks for pursuits, meetings, or reminders. Always confirm with the user before creating events.",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Title of the calendar event" },
            start_time: { type: "string", format: "date-time", description: "Start time in ISO 8601 format (e.g., 2024-01-15T09:00:00)" },
            end_time: { type: "string", format: "date-time", description: "End time in ISO 8601 format (e.g., 2024-01-15T10:00:00)" },
            description: { type: "string", description: "Optional description or notes for the event" },
            location: { type: "string", description: "Optional location for the event" },
          },
          required: ["title", "start_time", "end_time"],
        },
      },
    },
  ];
}
