import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-helpers";
import { CreatePursuitSchema } from "@/lib/schemas/pursuit";
import type { Pursuit } from "@/types/pursuit";

/**
 * GET /api/pursuits - List all pursuits
 * Query params:
 *   - status: 'active' | 'paused' | 'completed' | 'archived' | 'all' (default: 'active')
 */
export async function GET(request: Request) {
  try {
    // Require authentication
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "active";

    const supabase = await createClient();

    const query = supabase
      .from("pursuits")
      .select("*")
      .eq("user_id", user!.id)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false });

    if (status !== "all") {
      query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching pursuits:", error);
      throw error;
    }

    return NextResponse.json({ pursuits: data as Pursuit[] });
  } catch (error) {
    console.error("GET /api/pursuits error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pursuits - Create new pursuit
 */
export async function POST(request: Request) {
  try {
    // Require authentication
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const body = await request.json();
    const parseResult = CreatePursuitSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: parseResult.error.flatten()
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("pursuits")
      .insert({
        user_id: user!.id,
        ...parseResult.data,
      })
      .select()
      .single();

    if (error) {
      // Handle unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json(
          { error: "A pursuit with this name already exists" },
          { status: 409 }
        );
      }
      console.error("Error creating pursuit:", error);
      throw error;
    }

    return NextResponse.json({ pursuit: data as Pursuit }, { status: 201 });
  } catch (error) {
    console.error("POST /api/pursuits error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
