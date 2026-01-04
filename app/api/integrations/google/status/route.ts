import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: integration, error } = await supabase
    .from('user_integrations')
    .select('google_calendar_connected, calendar_sync_enabled, share_event_titles, share_event_descriptions, google_selected_calendars')
    .eq('user_id', user.id)
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 is "no rows returned" which is expected if user hasn't connected
    console.error('[Google Calendar Status] Database error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({
    connected: integration?.google_calendar_connected || false,
    settings: integration ? {
      calendar_sync_enabled: integration.calendar_sync_enabled,
      share_event_titles: integration.share_event_titles,
      share_event_descriptions: integration.share_event_descriptions,
      selected_calendars: integration.google_selected_calendars,
    } : null,
  })
}
