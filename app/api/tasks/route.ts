import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const completed = searchParams.get("completed");
    const priority = searchParams.get("priority");
    const category = searchParams.get("category");
    const date = searchParams.get("date");

    // TODO: Get user ID from auth session
    const userId = "mock-user-id"; // Replace with actual user ID from auth

    let query = supabase.from("tasks").select("*").eq("user_id", userId);

    if (completed !== null) {
      query = query.eq("completed", completed === "true");
    }

    if (priority) {
      query = query.eq("priority", priority);
    }

    if (category) {
      query = query.eq("category", category);
    }

    if (date) {
      // Filter tasks for a specific date
      const startOfDay = new Date(date);
      const endOfDay = new Date(date);
      endOfDay.setDate(endOfDay.getDate() + 1);

      query = query
        .gte("scheduled_time", startOfDay.toISOString())
        .lt("scheduled_time", endOfDay.toISOString());
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      console.error("Error fetching tasks:", error);
      return NextResponse.json(
        { error: "Failed to fetch tasks" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in tasks GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      description,
      completed,
      priority,
      category,
      estimated_time,
      deadline,
      scheduled_time,
      goal_id,
    } = body;

    // TODO: Get user ID from auth session
    const userId = "mock-user-id"; // Replace with actual user ID from auth

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        user_id: userId,
        title,
        description,
        completed: completed || false,
        priority,
        category,
        estimated_time,
        deadline,
        scheduled_time,
        goal_id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating task:", error);
      return NextResponse.json(
        { error: "Failed to create task" },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Error in tasks POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
