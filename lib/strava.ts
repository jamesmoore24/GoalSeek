import { createClient } from '@/lib/supabase/server'

// Types
export interface StravaAthlete {
  id: number
  firstname: string
  lastname: string
  profile: string
}

export interface StravaActivity {
  id: number
  name: string
  type: string
  sport_type: string
  start_date: string
  elapsed_time: number // seconds
  moving_time: number // seconds
  distance: number // meters
  average_heartrate?: number
  max_heartrate?: number
  suffer_score?: number
  average_speed: number // meters per second
  total_elevation_gain: number
}

interface IntegrationData {
  user_id: string
  strava_access_token: string
  strava_refresh_token: string
  strava_token_expires_at: string
  strava_athlete_id: string | null
}

/**
 * Refresh Strava access token if expired or expiring soon
 */
async function refreshTokenIfNeeded(integration: IntegrationData): Promise<string> {
  const expiresAt = new Date(integration.strava_token_expires_at)
  const now = new Date()

  // Refresh if expiring in next 5 minutes
  if (expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    return integration.strava_access_token
  }

  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID!,
      client_secret: process.env.STRAVA_CLIENT_SECRET!,
      refresh_token: integration.strava_refresh_token,
      grant_type: 'refresh_token',
    }),
  })

  const tokens = await response.json()

  if (!tokens.access_token) {
    throw new Error('Failed to refresh Strava token')
  }

  // Update stored token
  const supabase = await createClient()
  await supabase.from('user_integrations').update({
    strava_access_token: tokens.access_token,
    strava_refresh_token: tokens.refresh_token,
    strava_token_expires_at: new Date(tokens.expires_at * 1000).toISOString(),
  }).eq('user_id', integration.user_id)

  return tokens.access_token
}

/**
 * Get user's Strava integration data
 */
async function getIntegration(userId: string): Promise<IntegrationData | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('user_integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('strava_connected', true)
    .single()

  if (error || !data) {
    return null
  }

  return data as IntegrationData
}

/**
 * Get authenticated athlete info
 */
export async function getStravaAthlete(userId: string): Promise<StravaAthlete | null> {
  const integration = await getIntegration(userId)
  if (!integration) {
    return null
  }

  try {
    const accessToken = await refreshTokenIfNeeded(integration)

    const response = await fetch('https://www.strava.com/api/v3/athlete', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      console.error('[Strava] Get athlete failed:', await response.text())
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('[Strava] Error getting athlete:', error)
    return null
  }
}

/**
 * Get recent activities from Strava
 */
export async function getStravaActivities(
  userId: string,
  days: number = 7
): Promise<StravaActivity[]> {
  const integration = await getIntegration(userId)
  if (!integration) {
    return []
  }

  try {
    const accessToken = await refreshTokenIfNeeded(integration)

    // Calculate date range
    const after = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000)

    const url = new URL('https://www.strava.com/api/v3/athlete/activities')
    url.searchParams.set('after', after.toString())
    url.searchParams.set('per_page', '30')

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      console.error('[Strava] Get activities failed:', await response.text())
      return []
    }

    return await response.json()
  } catch (error) {
    console.error('[Strava] Error getting activities:', error)
    return []
  }
}

/**
 * Get activity stats summary for a user
 */
export async function getStravaStats(userId: string): Promise<{
  recentActivities: number
  totalDuration: number // minutes
  totalDistance: number // km
  activityTypes: Record<string, number>
} | null> {
  const activities = await getStravaActivities(userId, 7)

  if (activities.length === 0) {
    return null
  }

  const totalDuration = activities.reduce((sum, a) => sum + a.moving_time, 0) / 60
  const totalDistance = activities.reduce((sum, a) => sum + a.distance, 0) / 1000

  const activityTypes: Record<string, number> = {}
  for (const activity of activities) {
    const type = activity.sport_type || activity.type
    activityTypes[type] = (activityTypes[type] || 0) + 1
  }

  return {
    recentActivities: activities.length,
    totalDuration: Math.round(totalDuration),
    totalDistance: Math.round(totalDistance * 10) / 10,
    activityTypes,
  }
}

/**
 * Format Strava activities for LLM context
 */
export function formatStravaForLLM(activities: StravaActivity[]): string {
  if (activities.length === 0) {
    return 'No recent activities.'
  }

  return activities.slice(0, 10).map(activity => {
    const date = new Date(activity.start_date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
    const duration = Math.round(activity.moving_time / 60)
    const distance = activity.distance > 0
      ? `${(activity.distance / 1000).toFixed(1)}km`
      : ''
    const hr = activity.average_heartrate
      ? `${Math.round(activity.average_heartrate)}bpm avg`
      : ''

    const details = [distance, `${duration}min`, hr].filter(Boolean).join(', ')

    return `- ${date}: ${activity.name} (${activity.sport_type || activity.type}) - ${details}`
  }).join('\n')
}
