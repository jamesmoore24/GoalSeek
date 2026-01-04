import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID!
const STRAVA_REDIRECT_URI = process.env.STRAVA_REDIRECT_URI ||
  `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/strava/callback`

// Strava OAuth scopes - read activity data
const STRAVA_SCOPES = 'read,activity:read_all'

export async function GET(request: Request) {
  const { origin } = new URL(request.url)
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.redirect(`${origin}/login?error=auth_required`)
  }

  // Create state parameter with user ID and timestamp for CSRF protection
  const state = Buffer.from(JSON.stringify({
    userId: user.id,
    timestamp: Date.now(),
    nonce: crypto.randomUUID(),
  })).toString('base64url')

  // Build Strava OAuth URL
  const authUrl = new URL('https://www.strava.com/oauth/authorize')
  authUrl.searchParams.set('client_id', STRAVA_CLIENT_ID)
  authUrl.searchParams.set('redirect_uri', STRAVA_REDIRECT_URI)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', STRAVA_SCOPES)
  authUrl.searchParams.set('state', state)

  return NextResponse.redirect(authUrl.toString())
}
