import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const settingsSchema = z.object({
  calendar_sync_enabled: z.boolean().optional(),
  share_event_titles: z.boolean().optional(),
  share_event_descriptions: z.boolean().optional(),
})

export async function PATCH(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse and validate request body
  let body: z.infer<typeof settingsSchema>
  try {
    const rawBody = await request.json()
    body = settingsSchema.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Build update object with only provided fields
  const updates: Record<string, boolean> = {}
  if (body.calendar_sync_enabled !== undefined) {
    updates.calendar_sync_enabled = body.calendar_sync_enabled
  }
  if (body.share_event_titles !== undefined) {
    updates.share_event_titles = body.share_event_titles
  }
  if (body.share_event_descriptions !== undefined) {
    updates.share_event_descriptions = body.share_event_descriptions
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No settings to update' }, { status: 400 })
  }

  const { error } = await supabase
    .from('user_integrations')
    .update(updates)
    .eq('user_id', user.id)

  if (error) {
    console.error('[Google Calendar Settings] Database error:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
