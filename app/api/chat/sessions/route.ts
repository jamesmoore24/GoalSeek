import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    // TODO: Get user ID from auth session
    const userId = "00000000-0000-0000-0000-000000000000"; // Mock UUID for development

    console.log("🔍 Fetching chat sessions for user:", userId);
    console.log(
      "🔗 Supabase URL:",
      process.env.NEXT_PUBLIC_SUPABASE_URL ? "Set" : "Not set"
    );
    console.log(
      "🔑 Supabase Anon Key:",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "Set" : "Not set"
    );

    const { data, error } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("❌ Supabase error fetching chat sessions:", error);
      console.error("📊 Error details:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return NextResponse.json(
        {
          error: "Failed to fetch chat sessions",
          details: error.message,
          code: error.code,
        },
        { status: 500 }
      );
    }

    console.log(
      "✅ Successfully fetched chat sessions:",
      data?.length || 0,
      "sessions"
    );
    return NextResponse.json(data);
  } catch (error) {
    console.error("💥 Unexpected error in chat sessions GET:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title } = body;

    // TODO: Get user ID from auth session
    const userId = "00000000-0000-0000-0000-000000000000"; // Mock UUID for development

    const { data, error } = await supabase
      .from("chat_sessions")
      .insert({
        user_id: userId,
        title: title || "New Chat",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating chat session:", error);
      return NextResponse.json(
        { error: "Failed to create chat session" },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Error in chat sessions POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
