import { createClient } from '@/lib/supabase/server'

// Types
export interface GoogleCalendar {
  id: string
  summary: string
  description?: string
  primary?: boolean
  backgroundColor?: string
  foregroundColor?: string
  accessRole: 'freeBusyReader' | 'reader' | 'writer' | 'owner'
}

export interface GoogleCalendarEvent {
  id: string
  calendarId: string
  title: string
  start: Date
  end: Date
  description?: string
  location?: string
  isAllDay: boolean
  status: 'confirmed' | 'tentative' | 'cancelled'
  attendees?: Array<{ email: string; responseStatus: string }>
}

export interface CalendarEventOptions {
  startDate: Date
  endDate: Date
  maxResults?: number
}

interface IntegrationData {
  user_id: string
  google_access_token: string
  google_refresh_token: string
  google_token_expires_at: string
  google_selected_calendars: string[] | null
  calendar_sync_enabled: boolean
  share_event_titles: boolean
  share_event_descriptions: boolean
}

/**
 * Refresh Google access token if expired or expiring soon
 */
async function refreshTokenIfNeeded(integration: IntegrationData): Promise<string> {
  const expiresAt = new Date(integration.google_token_expires_at)
  const now = new Date()

  // Refresh if expiring in next 5 minutes
  if (expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    return integration.google_access_token
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: integration.google_refresh_token,
      grant_type: 'refresh_token',
    }),
  })

  const tokens = await response.json()

  if (!tokens.access_token) {
    throw new Error('Failed to refresh token')
  }

  // Update stored token
  const supabase = await createClient()
  await supabase.from('user_integrations').update({
    google_access_token: tokens.access_token,
    google_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  }).eq('user_id', integration.user_id)

  return tokens.access_token
}

/**
 * Get user's integration data
 */
async function getIntegration(userId: string): Promise<IntegrationData | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('user_integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('google_calendar_connected', true)
    .single()

  if (error || !data) {
    return null
  }

  return data as IntegrationData
}

/**
 * List all calendars the user has access to
 */
export async function listCalendars(userId: string): Promise<GoogleCalendar[]> {
  const integration = await getIntegration(userId)
  if (!integration) {
    return []
  }

  try {
    const accessToken = await refreshTokenIfNeeded(integration)

    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )

    if (!response.ok) {
      console.error('[Google Calendar] List calendars failed:', await response.text())
      return []
    }

    const data = await response.json()

    return (data.items || []).map((cal: Record<string, unknown>) => ({
      id: cal.id,
      summary: cal.summary || 'Untitled',
      description: cal.description,
      primary: cal.primary || false,
      backgroundColor: cal.backgroundColor,
      foregroundColor: cal.foregroundColor,
      accessRole: cal.accessRole,
    }))
  } catch (error) {
    console.error('[Google Calendar] Error listing calendars:', error)
    return []
  }
}

/**
 * Fetch events from a single calendar
 */
async function fetchCalendarEvents(
  accessToken: string,
  calendarId: string,
  options: CalendarEventOptions
): Promise<GoogleCalendarEvent[]> {
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`)
  url.searchParams.set('timeMin', options.startDate.toISOString())
  url.searchParams.set('timeMax', options.endDate.toISOString())
  url.searchParams.set('maxResults', String(options.maxResults || 100))
  url.searchParams.set('singleEvents', 'true')
  url.searchParams.set('orderBy', 'startTime')

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    console.error(`[Google Calendar] Fetch events failed for ${calendarId}:`, await response.text())
    return []
  }

  const data = await response.json()

  return (data.items || []).map((event: Record<string, unknown>) => ({
    id: event.id,
    calendarId,
    title: event.summary || '(No title)',
    start: new Date((event.start as Record<string, string>)?.dateTime || (event.start as Record<string, string>)?.date),
    end: new Date((event.end as Record<string, string>)?.dateTime || (event.end as Record<string, string>)?.date),
    description: event.description,
    location: event.location,
    isAllDay: !(event.start as Record<string, string>)?.dateTime,
    status: event.status || 'confirmed',
    attendees: (event.attendees as Array<{ email: string; responseStatus: string }>)?.map(a => ({
      email: a.email,
      responseStatus: a.responseStatus,
    })),
  }))
}

/**
 * Fetch Google Calendar events for a user across selected calendars
 */
export async function getGoogleCalendarEvents(
  userId: string,
  options: CalendarEventOptions
): Promise<GoogleCalendarEvent[]> {
  const integration = await getIntegration(userId)
  if (!integration || !integration.calendar_sync_enabled) {
    return []
  }

  try {
    const accessToken = await refreshTokenIfNeeded(integration)

    // Determine which calendars to fetch
    let calendarIds = integration.google_selected_calendars
    if (!calendarIds || calendarIds.length === 0) {
      // If no calendars selected, use primary
      calendarIds = ['primary']
    }

    // Fetch events from all selected calendars in parallel
    const eventArrays = await Promise.all(
      calendarIds.map(calendarId => fetchCalendarEvents(accessToken, calendarId, options))
    )

    // Merge and sort all events by start time
    const allEvents = eventArrays.flat()
    allEvents.sort((a, b) => a.start.getTime() - b.start.getTime())

    return allEvents
  } catch (error) {
    console.error('[Google Calendar] Error fetching events:', error)
    return []
  }
}

/**
 * Get free/busy time across selected calendars
 */
export async function getFreeBusyTime(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<Array<{ start: Date; end: Date }>> {
  const integration = await getIntegration(userId)
  if (!integration || !integration.calendar_sync_enabled) {
    return []
  }

  try {
    const accessToken = await refreshTokenIfNeeded(integration)

    // Determine which calendars to query
    let calendarIds = integration.google_selected_calendars
    if (!calendarIds || calendarIds.length === 0) {
      calendarIds = ['primary']
    }

    const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        items: calendarIds.map(id => ({ id })),
      }),
    })

    if (!response.ok) {
      console.error('[Google Calendar] Free/busy failed:', await response.text())
      return []
    }

    const data = await response.json()

    // Merge busy slots from all calendars
    const allBusySlots: Array<{ start: Date; end: Date }> = []

    for (const calendarId of calendarIds) {
      const calendarData = data.calendars?.[calendarId]
      if (calendarData?.busy) {
        for (const slot of calendarData.busy) {
          allBusySlots.push({
            start: new Date(slot.start),
            end: new Date(slot.end),
          })
        }
      }
    }

    // Sort and merge overlapping slots
    allBusySlots.sort((a, b) => a.start.getTime() - b.start.getTime())

    const mergedSlots: Array<{ start: Date; end: Date }> = []
    for (const slot of allBusySlots) {
      const last = mergedSlots[mergedSlots.length - 1]
      if (last && slot.start.getTime() <= last.end.getTime()) {
        // Overlapping, extend the end time
        last.end = new Date(Math.max(last.end.getTime(), slot.end.getTime()))
      } else {
        mergedSlots.push(slot)
      }
    }

    return mergedSlots
  } catch (error) {
    console.error('[Google Calendar] Error fetching free/busy:', error)
    return []
  }
}

export interface CreateEventParams {
  title: string
  startTime: Date
  endTime: Date
  description?: string
  location?: string
  calendarId?: string // Defaults to 'primary'
}

export interface CreatedEvent {
  id: string
  htmlLink: string
  title: string
  start: Date
  end: Date
}

/**
 * Create a new calendar event
 */
export async function createCalendarEvent(
  userId: string,
  params: CreateEventParams
): Promise<CreatedEvent | null> {
  const integration = await getIntegration(userId)
  if (!integration) {
    throw new Error('Calendar not connected')
  }

  try {
    const accessToken = await refreshTokenIfNeeded(integration)
    const calendarId = params.calendarId || 'primary'

    const eventBody = {
      summary: params.title,
      description: params.description,
      location: params.location,
      start: {
        dateTime: params.startTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: params.endTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    }

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error('[Google Calendar] Create event failed:', error)
      throw new Error(`Failed to create event: ${response.status}`)
    }

    const data = await response.json()

    return {
      id: data.id,
      htmlLink: data.htmlLink,
      title: data.summary,
      start: new Date(data.start.dateTime || data.start.date),
      end: new Date(data.end.dateTime || data.end.date),
    }
  } catch (error) {
    console.error('[Google Calendar] Error creating event:', error)
    throw error
  }
}

/**
 * Format calendar events for LLM context
 */
export function formatCalendarForLLM(
  events: GoogleCalendarEvent[],
  options: { shareTitles: boolean; shareDescriptions: boolean }
): string {
  if (events.length === 0) {
    return 'No upcoming events.'
  }

  // Group events by day
  const byDay = new Map<string, GoogleCalendarEvent[]>()

  for (const event of events) {
    const day = event.start.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
    if (!byDay.has(day)) {
      byDay.set(day, [])
    }
    byDay.get(day)!.push(event)
  }

  // Format each day's events
  return Array.from(byDay.entries())
    .map(([day, dayEvents]) => {
      const eventsList = dayEvents
        .map(e => {
          const time = e.isAllDay
            ? 'All day'
            : `${e.start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${e.end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`

          const title = options.shareTitles ? e.title : '[Event]'
          const location = e.location ? ` (${e.location})` : ''
          const description = options.shareDescriptions && e.description
            ? `\n      ${e.description.slice(0, 100)}${e.description.length > 100 ? '...' : ''}`
            : ''

          return `  - ${time}: ${title}${location}${description}`
        })
        .join('\n')

      return `**${day}**\n${eventsList}`
    })
    .join('\n\n')
}

/**
 * Format busy slots for LLM context
 */
export function formatBusySlots(slots: Array<{ start: Date; end: Date }>): string {
  if (slots.length === 0) {
    return 'No busy slots found - calendar appears open.'
  }

  return slots
    .map(slot => `- ${slot.start.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })} to ${slot.end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`)
    .join('\n')
}
