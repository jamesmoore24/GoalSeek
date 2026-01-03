import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { UpdateProfileSchema } from "@/lib/schemas/planning";
import { Profile } from "@/types/planning";

export const dynamic = "force-dynamic";

// TODO: Replace with actual auth
const MOCK_USER_ID = "00000000-0000-0000-0000-000000000000";

// GET /api/profiles - Get user profile
export async function GET() {
  try {
    const userId = MOCK_USER_ID;
    const supabase = createClient();

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error && error.code === "PGRST116") {
      // Profile doesn't exist, create default
      const { data: newProfile, error: insertError } = await supabase
        .from("profiles")
        .insert({ id: userId })
        .select()
        .single();

      if (insertError) throw insertError;
      return NextResponse.json({ profile: newProfile as Profile });
    }

    if (error) throw error;

    return NextResponse.json({ profile: data as Profile });
  } catch (error) {
    console.error("GET /api/profiles error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/profiles - Update user profile
export async function PUT(request: Request) {
  try {
    const body = await request.json();

    const parseResult = UpdateProfileSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const userId = MOCK_USER_ID;
    const supabase = createClient();

    // Upsert profile
    const { data, error } = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        ...parseResult.data,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ profile: data as Profile });
  } catch (error) {
    console.error("PUT /api/profiles error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
