import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { isGarminConfigured } from '@/lib/garmin'

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: integration } = await supabase
    .from('user_integrations')
    .select('strava_connected')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({
    strava_connected: integration?.strava_connected ?? false,
    // Garmin is configured via env vars, not OAuth
    garmin_connected: isGarminConfigured(),
  })
}
