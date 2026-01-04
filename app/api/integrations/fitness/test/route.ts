import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getStravaActivities, getStravaStats, formatStravaForLLM } from '@/lib/strava'
import { getGarminWellnessSummary, formatGarminForLLM, isGarminConfigured } from '@/lib/garmin'

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: Record<string, unknown> = {
    user_id: user.id,
    timestamp: new Date().toISOString(),
  }

  // Test Strava
  try {
    const stravaActivities = await getStravaActivities(user.id, 7)
    const stravaStats = await getStravaStats(user.id)
    results.strava = {
      connected: stravaActivities.length > 0 || stravaStats !== null,
      activities_count: stravaActivities.length,
      activities: stravaActivities.slice(0, 3), // First 3 for preview
      stats: stravaStats,
      llm_format: formatStravaForLLM(stravaActivities),
    }
  } catch (error) {
    results.strava = {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }

  // Test Garmin
  try {
    const garminConfigured = isGarminConfigured()
    if (garminConfigured) {
      const garminData = await getGarminWellnessSummary()
      results.garmin = {
        configured: true,
        data: garminData,
        llm_format: garminData ? formatGarminForLLM(garminData) : 'No data available',
      }
    } else {
      results.garmin = {
        configured: false,
        message: 'GARMIN_EMAIL and GARMIN_PASSWORD not set in environment',
      }
    }
  } catch (error) {
    results.garmin = {
      configured: isGarminConfigured(),
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }

  return NextResponse.json(results, { status: 200 })
}
