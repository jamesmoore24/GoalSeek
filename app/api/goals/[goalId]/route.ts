import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: { goalId: string } }
) {
  try {
    const { goalId } = params;

    // TODO: Get user ID from auth session
    const userId = "mock-user-id"; // Replace with actual user ID from auth

    const { data, error } = await supabase
      .from("goals")
      .select("*")
      .eq("id", goalId)
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Goal not found" }, { status: 404 });
      }
      console.error("Error fetching goal:", error);
      return NextResponse.json(
        { error: "Failed to fetch goal" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in goal GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { goalId: string } }
) {
  try {
    const { goalId } = params;
    const body = await request.json();

    // TODO: Get user ID from auth session
    const userId = "mock-user-id"; // Replace with actual user ID from auth

    const { data, error } = await supabase
      .from("goals")
      .update(body)
      .eq("id", goalId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Goal not found" }, { status: 404 });
      }
      console.error("Error updating goal:", error);
      return NextResponse.json(
        { error: "Failed to update goal" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in goal PUT:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { goalId: string } }
) {
  try {
    const { goalId } = params;

    // TODO: Get user ID from auth session
    const userId = "mock-user-id"; // Replace with actual user ID from auth

    const { error } = await supabase
      .from("goals")
      .delete()
      .eq("id", goalId)
      .eq("user_id", userId);

    if (error) {
      console.error("Error deleting goal:", error);
      return NextResponse.json(
        { error: "Failed to delete goal" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Goal deleted successfully" },
      { status: 204 }
    );
  } catch (error) {
    console.error("Error in goal DELETE:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
