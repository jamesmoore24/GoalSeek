import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { CreateSubgoalSchema } from "@/lib/schemas/pursuit";
import type { Subgoal } from "@/types/pursuit";

// Mock user ID (replace with actual auth when implemented)
const MOCK_USER_ID = "00000000-0000-0000-0000-000000000000";

/**
 * GET /api/pursuits/[id]/subgoals - List subgoals for a pursuit
 * Query params:
 *   - status: 'active' | 'paused' | 'completed' | 'cancelled' | 'all' (default: 'active')
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "active";

    const supabase = createClient();

    const query = supabase
      .from("subgoals")
      .select("*")
      .eq("pursuit_id", params.id)
      .eq("user_id", MOCK_USER_ID)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false });

    if (status !== "all") {
      query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching subgoals:", error);
      throw error;
    }

    return NextResponse.json({ subgoals: data as Subgoal[] });
  } catch (error) {
    console.error("GET /api/pursuits/[id]/subgoals error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pursuits/[id]/subgoals - Create new subgoal
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const parseResult = CreateSubgoalSchema.safeParse(body);

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

    // Verify pursuit exists and belongs to user
    const { data: pursuit, error: pursuitError } = await supabase
      .from("pursuits")
      .select("id")
      .eq("id", params.id)
      .eq("user_id", MOCK_USER_ID)
      .single();

    if (pursuitError && pursuitError.code === "PGRST116") {
      return NextResponse.json(
        { error: "Pursuit not found" },
        { status: 404 }
      );
    }

    if (pursuitError) {
      console.error("Error verifying pursuit:", pursuitError);
      throw pursuitError;
    }

    const { data, error } = await supabase
      .from("subgoals")
      .insert({
        pursuit_id: params.id,
        user_id: MOCK_USER_ID,
        ...parseResult.data,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating subgoal:", error);
      throw error;
    }

    return NextResponse.json({ subgoal: data as Subgoal }, { status: 201 });
  } catch (error) {
    console.error("POST /api/pursuits/[id]/subgoals error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
