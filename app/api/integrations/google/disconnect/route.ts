import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get current integration to revoke token
  const { data: integration } = await supabase
    .from('user_integrations')
    .select('google_access_token')
    .eq('user_id', user.id)
    .single()

  // Revoke the Google token if it exists
  if (integration?.google_access_token) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${integration.google_access_token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
    } catch (error) {
      console.error('[Google Calendar Disconnect] Failed to revoke token:', error)
      // Continue anyway - we'll still remove from our database
    }
  }

  // Clear calendar-related fields from the integration record
  const { error } = await supabase
    .from('user_integrations')
    .update({
      google_calendar_connected: false,
      google_access_token: null,
      google_refresh_token: null,
      google_token_expires_at: null,
      google_calendar_scopes: null,
      google_selected_calendars: null,
    })
    .eq('user_id', user.id)

  if (error) {
    console.error('[Google Calendar Disconnect] Database error:', error)
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
