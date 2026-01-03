import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { UpdatePursuitSchema } from "@/lib/schemas/pursuit";
import type { Pursuit } from "@/types/pursuit";

// Mock user ID (replace with actual auth when implemented)
const MOCK_USER_ID = "00000000-0000-0000-0000-000000000000";

/**
 * GET /api/pursuits/[id] - Get single pursuit
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("pursuits")
      .select("*")
      .eq("id", params.id)
      .eq("user_id", MOCK_USER_ID)
      .single();

    if (error && error.code === "PGRST116") {
      return NextResponse.json(
        { error: "Pursuit not found" },
        { status: 404 }
      );
    }

    if (error) {
      console.error("Error fetching pursuit:", error);
      throw error;
    }

    return NextResponse.json({ pursuit: data as Pursuit });
  } catch (error) {
    console.error("GET /api/pursuits/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/pursuits/[id] - Update pursuit
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const parseResult = UpdatePursuitSchema.safeParse(body);

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
    const { data, error } = await supabase
      .from("pursuits")
      .update(parseResult.data)
      .eq("id", params.id)
      .eq("user_id", MOCK_USER_ID)
      .select()
      .single();

    if (error && error.code === "PGRST116") {
      return NextResponse.json(
        { error: "Pursuit not found" },
        { status: 404 }
      );
    }

    if (error) {
      // Handle unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json(
          { error: "A pursuit with this name already exists" },
          { status: 409 }
        );
      }
      console.error("Error updating pursuit:", error);
      throw error;
    }

    return NextResponse.json({ pursuit: data as Pursuit });
  } catch (error) {
    console.error("PATCH /api/pursuits/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/pursuits/[id] - Delete pursuit
 * Note: This will cascade delete all subgoals, executables, and context
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from("pursuits")
      .delete()
      .eq("id", params.id)
      .eq("user_id", MOCK_USER_ID);

    if (error && error.code === "PGRST116") {
      return NextResponse.json(
        { error: "Pursuit not found" },
        { status: 404 }
      );
    }

    if (error) {
      console.error("Error deleting pursuit:", error);
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/pursuits/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
