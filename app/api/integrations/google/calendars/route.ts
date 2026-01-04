import { createClient } from '@/lib/supabase/server'
import { listCalendars } from '@/lib/google-calendar'
import { NextResponse } from 'next/server'
import { z } from 'zod'

/**
 * GET: List all available calendars for the authenticated user
 */
export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's selected calendars
  const { data: integration } = await supabase
    .from('user_integrations')
    .select('google_calendar_connected, google_selected_calendars')
    .eq('user_id', user.id)
    .single()

  if (!integration?.google_calendar_connected) {
    return NextResponse.json({ error: 'Calendar not connected' }, { status: 400 })
  }

  // List all available calendars
  const calendars = await listCalendars(user.id)

  return NextResponse.json({
    calendars,
    selected: integration.google_selected_calendars || [],
  })
}

const updateSchema = z.object({
  selected: z.array(z.string()),
})

/**
 * PUT: Update selected calendars
 */
export async function PUT(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse and validate request body
  let body: z.infer<typeof updateSchema>
  try {
    const rawBody = await request.json()
    body = updateSchema.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Update selected calendars
  const { error } = await supabase
    .from('user_integrations')
    .update({
      google_selected_calendars: body.selected.length > 0 ? body.selected : null,
    })
    .eq('user_id', user.id)

  if (error) {
    console.error('[Google Calendars] Database error:', error)
    return NextResponse.json({ error: 'Failed to update calendars' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
