import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID!
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET!

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // Handle OAuth errors
  if (error) {
    console.error('[Strava OAuth] Error:', error)
    return NextResponse.redirect(`${origin}/settings?error=strava_auth_denied`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/settings?error=strava_auth_failed`)
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
  const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  })

  const tokens = await tokenResponse.json()

  if (!tokens.access_token) {
    console.error('[Strava OAuth] Token exchange failed:', tokens)
    return NextResponse.redirect(`${origin}/settings?error=token_exchange_failed`)
  }

  // Calculate token expiry time
  const expiresAt = new Date(tokens.expires_at * 1000).toISOString()

  // Store tokens in database using upsert
  console.log('[Strava OAuth] Attempting to save tokens for user:', user.id)

  const { data: upsertData, error: dbError } = await supabase
    .from('user_integrations')
    .upsert({
      user_id: user.id,
      strava_connected: true,
      strava_access_token: tokens.access_token,
      strava_refresh_token: tokens.refresh_token,
      strava_token_expires_at: expiresAt,
      strava_athlete_id: tokens.athlete?.id?.toString(),
    }, {
      onConflict: 'user_id',
    })
    .select()

  console.log('[Strava OAuth] Upsert result:', { data: upsertData, error: dbError })

  if (dbError) {
    console.error('[Strava OAuth] Database error:', dbError)
    return NextResponse.redirect(`${origin}/settings?error=save_failed`)
  }

  if (!upsertData || upsertData.length === 0) {
    console.error('[Strava OAuth] Upsert returned no data - likely RLS policy issue')
    return NextResponse.redirect(`${origin}/settings?error=save_failed`)
  }

  return NextResponse.redirect(`${origin}/settings?success=strava_connected`)
}
