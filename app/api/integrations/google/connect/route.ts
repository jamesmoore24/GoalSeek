import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CALENDAR_REDIRECT_URI = process.env.GOOGLE_CALENDAR_REDIRECT_URI ||
  `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/google/callback`

const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar', // Full calendar access (read, write, list calendars)
]

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

  // Build Google OAuth URL
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID)
  authUrl.searchParams.set('redirect_uri', GOOGLE_CALENDAR_REDIRECT_URI)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', CALENDAR_SCOPES.join(' '))
  authUrl.searchParams.set('access_type', 'offline') // Get refresh token
  authUrl.searchParams.set('prompt', 'consent') // Force consent to get refresh token
  authUrl.searchParams.set('state', state)

  return NextResponse.redirect(authUrl.toString())
}
