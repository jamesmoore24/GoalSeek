import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Get the authenticated user from the request
 * Returns null if not authenticated
 */
export async function getAuthUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

/**
 * Require authentication for an API route
 * Returns the user if authenticated, or a 401 response if not
 */
export async function requireAuth() {
  const user = await getAuthUser()

  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  return { user, error: null }
}
