import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Check Garmin config inline to avoid importing garmin-connect library at module level
function isGarminConfigured(): boolean {
  return !!(process.env.GARMIN_EMAIL && process.env.GARMIN_PASSWORD)
}

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

  // Test Garmin (dynamically import to avoid bundling issues)
  try {
    const garminConfigured = isGarminConfigured()
    if (garminConfigured) {
      const { getGarminWellnessSummary, formatGarminForLLM } = await import('@/lib/garmin')
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
