import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get current integration to deauthorize token
  const { data: integration } = await supabase
    .from('user_integrations')
    .select('strava_access_token')
    .eq('user_id', user.id)
    .single()

  // Deauthorize the Strava token if it exists
  if (integration?.strava_access_token) {
    try {
      await fetch('https://www.strava.com/oauth/deauthorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          access_token: integration.strava_access_token,
        }),
      })
    } catch (error) {
      console.error('[Strava Disconnect] Failed to deauthorize token:', error)
      // Continue anyway - we'll still remove from our database
    }
  }

  // Clear Strava-related fields from the integration record
  const { error } = await supabase
    .from('user_integrations')
    .update({
      strava_connected: false,
      strava_access_token: null,
      strava_refresh_token: null,
      strava_token_expires_at: null,
      strava_athlete_id: null,
    })
    .eq('user_id', user.id)

  if (error) {
    console.error('[Strava Disconnect] Database error:', error)
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
