import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;

    // TODO: Get user ID from auth session
    const userId = "mock-user-id"; // Replace with actual user ID from auth

    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching chat messages:", error);
      return NextResponse.json(
        { error: "Failed to fetch chat messages" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in chat messages GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;
    const body = await request.json();
    const { content, metadata } = body;

    // TODO: Get user ID from auth session
    const userId = "mock-user-id"; // Replace with actual user ID from auth

    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        user_id: userId,
        session_id: sessionId,
        role: "user",
        content,
        metadata: metadata || {},
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating chat message:", error);
      return NextResponse.json(
        { error: "Failed to create chat message" },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Error in chat messages POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
