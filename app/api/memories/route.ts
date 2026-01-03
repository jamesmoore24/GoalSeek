import { NextResponse } from "next/server";
import { getOpenRouterInstance, PLAN_MODEL } from "@/app/lib/openai";
import { createClient } from "@/lib/supabase";

// Mock user ID (replace with actual auth when implemented)
const MOCK_USER_ID = "00000000-0000-0000-0000-000000000000";

/**
 * POST /api/memories - Compress and save conversation as a memory
 * Request body:
 *   - messages: Array<{role, content}>
 *   - pursuit_id?: string (optional - to associate memory with a pursuit)
 */
export async function POST(request: Request) {
  try {
    const { messages, pursuit_id } = await request.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "messages array is required and must not be empty" },
        { status: 400 }
      );
    }

    // Compress the conversation using LLM
    const compressed = await compressConversation(messages);

    if (!compressed) {
      return NextResponse.json(
        { error: "Failed to compress conversation" },
        { status: 500 }
      );
    }

    // Save to database
    const supabase = createClient();
    const { data, error } = await supabase
      .from("user_memories")
      .insert({
        user_id: MOCK_USER_ID,
        content: compressed,
        pursuit_id: pursuit_id || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to save memory:", error);
      return NextResponse.json(
        { error: "Failed to save memory to database" },
        { status: 500 }
      );
    }

    return NextResponse.json({ memory: data });
  } catch (error) {
    console.error("Memory save error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/memories - Fetch recent memories for context
 * Query params:
 *   - limit?: number (default: 20)
 *   - pursuit_id?: string (filter by pursuit)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const pursuit_id = searchParams.get("pursuit_id");

    const supabase = createClient();
    let query = supabase
      .from("user_memories")
      .select("*")
      .eq("user_id", MOCK_USER_ID)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (pursuit_id) {
      query = query.eq("pursuit_id", pursuit_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch memories:", error);
      return NextResponse.json(
        { error: "Failed to fetch memories" },
        { status: 500 }
      );
    }

    return NextResponse.json({ memories: data || [] });
  } catch (error) {
    console.error("Memory fetch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Compress a conversation into a concise takeaway using LLM
 */
async function compressConversation(messages: Array<{ role: string; content: string }>): Promise<string | null> {
  try {
    const openRouter = getOpenRouterInstance();

    // Format conversation for compression
    const conversationText = messages
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n\n");

    const response = await openRouter.chat.completions.create({
      model: PLAN_MODEL,
      messages: [
        {
          role: "system",
          content: `Compress this conversation into a concise takeaway (2-4 sentences max).
Focus on:
- Key decisions made
- Important insights or learnings
- Action items or next steps
- Any commitments or goals set

Be specific and actionable. Write in first person as if the user is noting this for themselves.
Do NOT include any preamble like "Here's the takeaway:" - just write the takeaway directly.`,
        },
        {
          role: "user",
          content: `Conversation to compress:\n\n${conversationText}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 300,
    });

    return response.choices[0]?.message?.content || null;
  } catch (error) {
    console.error("Conversation compression error:", error);
    return null;
  }
}
