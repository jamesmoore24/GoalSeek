import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import type { PursuitProgress } from "@/types/pursuit";

// Mock user ID (replace with actual auth when implemented)
const MOCK_USER_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Get week start date (Monday of current week)
 */
function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * GET /api/pursuits/[id]/progress - Calculate weekly progress for a pursuit
 * Query params:
 *   - week_start: ISO date string (default: current week)
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const weekStart = searchParams.get("week_start") || getWeekStart();

    const supabase = createClient();

    // Get pursuit details
    const { data: pursuit, error: pursuitError } = await supabase
      .from("pursuits")
      .select("*")
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
      console.error("Error fetching pursuit:", pursuitError);
      throw pursuitError;
    }

    // Calculate week end (7 days after start)
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    // Get week logs for this pursuit
    const { data: logs, error: logsError } = await supabase
      .from("day_logs")
      .select("started_at, duration_minutes, tag")
      .eq("pursuit_id", params.id)
      .eq("user_id", MOCK_USER_ID)
      .gte("started_at", weekStart)
      .lt("started_at", weekEnd.toISOString())
      .order("started_at", { ascending: false });

    if (logsError) {
      console.error("Error fetching logs:", logsError);
      throw logsError;
    }

    // Calculate progress
    const hoursLogged = (logs || []).reduce(
      (sum, log) => sum + log.duration_minutes / 60,
      0
    );

    const progressPercentage = pursuit.weekly_hours_target > 0
      ? (hoursLogged / pursuit.weekly_hours_target) * 100
      : 0;

    // Determine status
    let status: 'on_track' | 'behind' | 'ahead';
    if (progressPercentage >= 90 && progressPercentage <= 110) {
      status = 'on_track';
    } else if (progressPercentage > 110) {
      status = 'ahead';
    } else {
      status = 'behind';
    }

    // Format recent logs
    const recentLogs = (logs || []).slice(0, 10).map(log => ({
      date: log.started_at.split('T')[0],
      hours: Number((log.duration_minutes / 60).toFixed(2)),
      tag: log.tag,
    }));

    const progress: PursuitProgress = {
      pursuit_id: params.id,
      week_start: weekStart,
      hours_logged: Number(hoursLogged.toFixed(2)),
      hours_target: pursuit.weekly_hours_target,
      progress_percentage: Number(progressPercentage.toFixed(1)),
      status,
      recent_logs: recentLogs,
    };

    return NextResponse.json({ progress });
  } catch (error) {
    console.error("GET /api/pursuits/[id]/progress error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
