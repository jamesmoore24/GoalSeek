import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { UpdateSubgoalSchema } from "@/lib/schemas/pursuit";
import type { Subgoal } from "@/types/pursuit";

// Mock user ID (replace with actual auth when implemented)
const MOCK_USER_ID = "00000000-0000-0000-0000-000000000000";

/**
 * GET /api/subgoals/[id] - Get single subgoal
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("subgoals")
      .select("*")
      .eq("id", params.id)
      .eq("user_id", MOCK_USER_ID)
      .single();

    if (error && error.code === "PGRST116") {
      return NextResponse.json(
        { error: "Subgoal not found" },
        { status: 404 }
      );
    }

    if (error) {
      console.error("Error fetching subgoal:", error);
      throw error;
    }

    return NextResponse.json({ subgoal: data as Subgoal });
  } catch (error) {
    console.error("GET /api/subgoals/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/subgoals/[id] - Update subgoal
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const parseResult = UpdateSubgoalSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: parseResult.error.flatten()
        },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // If completing the subgoal, set completed_at
    const updates: any = { ...parseResult.data };
    if (updates.status === 'completed' && !updates.completed_at) {
      updates.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("subgoals")
      .update(updates)
      .eq("id", params.id)
      .eq("user_id", MOCK_USER_ID)
      .select()
      .single();

    if (error && error.code === "PGRST116") {
      return NextResponse.json(
        { error: "Subgoal not found" },
        { status: 404 }
      );
    }

    if (error) {
      console.error("Error updating subgoal:", error);
      throw error;
    }

    return NextResponse.json({ subgoal: data as Subgoal });
  } catch (error) {
    console.error("PATCH /api/subgoals/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/subgoals/[id] - Delete subgoal
 * Note: This will cascade delete all executables
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from("subgoals")
      .delete()
      .eq("id", params.id)
      .eq("user_id", MOCK_USER_ID);

    if (error && error.code === "PGRST116") {
      return NextResponse.json(
        { error: "Subgoal not found" },
        { status: 404 }
      );
    }

    if (error) {
      console.error("Error deleting subgoal:", error);
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/subgoals/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
