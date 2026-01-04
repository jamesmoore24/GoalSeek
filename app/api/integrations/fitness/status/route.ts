import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Check Garmin config inline to avoid importing garmin-connect library
function isGarminConfigured(): boolean {
  return !!(process.env.GARMIN_EMAIL && process.env.GARMIN_PASSWORD)
}

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    // Garmin is configured via env vars, not OAuth
    garmin_connected: isGarminConfigured(),
  })
}
