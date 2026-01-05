import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!
const GOOGLE_CALENDAR_REDIRECT_URI = process.env.GOOGLE_CALENDAR_REDIRECT_URI ||
  `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/google/callback`

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // Handle OAuth errors
  if (error) {
    console.error('[Google Calendar OAuth] Error:', error)
    return NextResponse.redirect(`${origin}/settings?error=calendar_auth_denied`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/settings?error=calendar_auth_failed`)
  }

  // Verify state parameter
  let stateData: { userId: string; timestamp: number }
  try {
    stateData = JSON.parse(Buffer.from(state, 'base64url').toString())
  } catch {
    return NextResponse.redirect(`${origin}/settings?error=invalid_state`)
  }

  // Check state is not too old (5 minute timeout)
  if (Date.now() - stateData.timestamp > 5 * 60 * 1000) {
    return NextResponse.redirect(`${origin}/settings?error=auth_timeout`)
  }

  // Verify the user is still authenticated
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user || user.id !== stateData.userId) {
    return NextResponse.redirect(`${origin}/settings?error=user_mismatch`)
  }

  // Exchange code for tokens
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_CALENDAR_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  })

  const tokens = await tokenResponse.json()

  if (!tokens.access_token) {
    console.error('[Google Calendar OAuth] Token exchange failed:', tokens)
    return NextResponse.redirect(`${origin}/settings?error=token_exchange_failed`)
  }

  // Calculate token expiry time
  const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString()

  // Store tokens in database using upsert
  const { error: dbError } = await supabase
    .from('user_integrations')
    .upsert({
      user_id: user.id,
      google_calendar_connected: true,
      calendar_sync_enabled: true, // Enable sync by default when connecting
      google_access_token: tokens.access_token,
      google_refresh_token: tokens.refresh_token,
      google_token_expires_at: expiresAt,
      google_calendar_scopes: tokens.scope?.split(' ') || [],
    }, {
      onConflict: 'user_id',
    })

  if (dbError) {
    console.error('[Google Calendar OAuth] Database error:', dbError)
    return NextResponse.redirect(`${origin}/settings?error=save_failed`)
  }

  return NextResponse.redirect(`${origin}/settings?success=calendar_connected`)
}
