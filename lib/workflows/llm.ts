import OpenAI from 'openai'
import { type PlanMyDayContext, type AgendaItem, type AgendaCategory } from '@/types/workflow'

// ============================================
// LLM AGENDA GENERATION
// ============================================

const openRouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
})

const PLAN_MODEL = 'google/gemini-2.5-flash'

/**
 * Generate an agenda using LLM
 */
export async function generateAgendaWithLLM(
  context: PlanMyDayContext,
  previousFeedback: string[] = []
): Promise<AgendaItem[]> {
  const systemPrompt = buildSystemPrompt()
  const userPrompt = buildUserPrompt(context, previousFeedback)

  try {
    const response = await openRouter.chat.completions.create({
      model: PLAN_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from LLM')
    }

    // Parse the JSON response
    const parsed = JSON.parse(content)
    const items = parsed.agenda || parsed.items || []

    // Convert to AgendaItem format
    return items.map((item: Record<string, unknown>) => ({
      id: crypto.randomUUID(),
      user_id: '', // Will be set by executor
      date: context.date,
      start_time: item.start_time as string,
      end_time: item.end_time as string,
      title: item.title as string,
      description: item.description as string | null,
      category: mapCategory(item.category as string),
      pursuit_id: item.pursuit_id as string | null,
      intensity: item.intensity as 'low' | 'medium' | 'high' | null,
      location: item.location as string | null,
      status: 'proposed' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))
  } catch (error) {
    console.error('[LLM] Error generating agenda:', error)
    throw error
  }
}

/**
 * Build system prompt for agenda generation
 */
function buildSystemPrompt(): string {
  return `You are an expert day planner and productivity coach. Your role is to generate an optimal daily agenda based on the user's context.

## Your Principles

1. **Circadian Alignment**: Schedule high-cognitive tasks during natural peak hours (typically morning), creative tasks in the afternoon, and wind-down activities in the evening.

2. **Energy Management**: Balance intense work blocks with recovery. Avoid scheduling back-to-back high-intensity activities.

3. **Health First**: Prioritize morning sunlight exposure, physical activity, and sleep protection. Never schedule intense activities close to bedtime.

4. **Constraint Respect**: Honor existing calendar events, caffeine cutoffs, and user preferences.

5. **Goal Progress**: Allocate time toward pursuits based on their weekly targets and current progress.

6. **Buffer Time**: Include transition time between activities. Don't over-schedule.

## Output Format

Return a JSON object with an "agenda" array. Each item should have:
- start_time: "HH:mm" format (24-hour)
- end_time: "HH:mm" format
- title: Brief activity name
- description: Optional longer description
- category: One of: META, STARTUP, HEDGE, HEALTH, SOCIAL, ADMIN, RECOVERY, MEETING, COMMUTE, LEARNING, WRITING, ERRANDS
- intensity: "low", "medium", or "high"
- location: Optional location hint (home, gym, outdoor, office, etc.)
- pursuit_id: Optional pursuit UUID if this activity contributes to a specific pursuit

Example:
{
  "agenda": [
    {
      "start_time": "07:00",
      "end_time": "07:30",
      "title": "Morning sunlight walk",
      "description": "15-minute walk outside for circadian rhythm",
      "category": "HEALTH",
      "intensity": "low",
      "location": "outdoor"
    },
    {
      "start_time": "08:00",
      "end_time": "10:00",
      "title": "Deep work: Project X",
      "description": "Focused coding session",
      "category": "META",
      "intensity": "high",
      "location": "home"
    }
  ]
}

Be practical and realistic. Don't overload the day. Leave some flexibility.`
}

/**
 * Build user prompt with context
 */
function buildUserPrompt(
  context: PlanMyDayContext,
  previousFeedback: string[]
): string {
  const sections: string[] = []

  // Date and profile
  sections.push(`## Today: ${context.date}`)
  sections.push(`
## User Preferences
- Day starts: ${context.profile.day_start_time}
- Day ends: ${context.profile.day_end_time}
- Sleep time: ${context.profile.sleep_time}
- Wake time: ${context.profile.wake_time}
- Caffeine cutoff: ${context.profile.caffeine_cutoff_hours} hours before sleep
- Morning sunlight: ${context.profile.morning_sunlight_minutes} minutes
- Preferred workout: ${context.profile.preferred_workout_time}
`)

  // Calendar events (existing commitments)
  if (context.calendar_events.length > 0) {
    sections.push(`## Existing Calendar Events (DO NOT overlap with these)`)
    for (const event of context.calendar_events) {
      const startTime = new Date(event.start).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      const endTime = new Date(event.end).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      const location = event.location ? ` (${event.location})` : ''
      sections.push(`- ${startTime}-${endTime}: ${event.title}${location}`)
    }
    sections.push('')
  }

  // Busy slots
  if (context.busy_slots.length > 0) {
    sections.push(`## Busy Time Slots`)
    for (const slot of context.busy_slots) {
      const start = new Date(slot.start).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      const end = new Date(slot.end).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      sections.push(`- ${start}-${end}`)
    }
    sections.push('')
  }

  // Pursuits and progress
  if (context.pursuits.length > 0) {
    sections.push(`## Active Pursuits (allocate time based on targets)`)
    for (const pursuit of context.pursuits) {
      const progress = pursuit.weekly_hours_target > 0
        ? Math.round((pursuit.hours_logged_this_week / pursuit.weekly_hours_target) * 100)
        : 100
      const status = progress >= 100 ? '✅' : progress >= 70 ? '🟡' : '🔴'
      sections.push(`- ${status} ${pursuit.name}: ${pursuit.hours_logged_this_week.toFixed(1)}/${pursuit.weekly_hours_target}h this week (${progress}%)`)
    }
    sections.push('')
  }

  // Relevant memories
  if (context.memories.length > 0) {
    sections.push(`## Relevant Context`)
    for (const memory of context.memories.slice(0, 5)) {
      sections.push(`- [${memory.type}] ${memory.content}`)
    }
    sections.push('')
  }

  // Previous feedback (for iterations)
  if (previousFeedback.length > 0) {
    sections.push(`## Feedback from Previous Attempts`)
    sections.push(`Please address these concerns in this iteration:`)
    for (const feedback of previousFeedback) {
      sections.push(`- ${feedback}`)
    }
    sections.push('')
  }

  sections.push(`## Task
Generate an optimized daily agenda for ${context.date}.
- Respect all existing calendar events
- Include morning sunlight exposure
- Allocate time toward pursuits that need more hours
- Include physical activity
- Respect the caffeine cutoff (no coffee after ${calculateCaffeineCutoff(context)})
- End high-intensity activities by ${calculateWindDownTime(context)}
- Return valid JSON with the "agenda" array`)

  return sections.join('\n')
}

/**
 * Calculate caffeine cutoff time
 */
function calculateCaffeineCutoff(context: PlanMyDayContext): string {
  const [sleepHour, sleepMin] = context.profile.sleep_time.split(':').map(Number)
  const cutoffHour = sleepHour - context.profile.caffeine_cutoff_hours

  return `${cutoffHour.toString().padStart(2, '0')}:${sleepMin.toString().padStart(2, '0')}`
}

/**
 * Calculate wind-down time (2 hours before sleep)
 */
function calculateWindDownTime(context: PlanMyDayContext): string {
  const [sleepHour, sleepMin] = context.profile.sleep_time.split(':').map(Number)
  const windDownHour = sleepHour - 2

  return `${windDownHour.toString().padStart(2, '0')}:${sleepMin.toString().padStart(2, '0')}`
}

/**
 * Map string category to AgendaCategory
 */
function mapCategory(category: string | undefined): AgendaCategory | null {
  if (!category) return null

  const upper = category.toUpperCase()
  const validCategories: AgendaCategory[] = [
    'META', 'STARTUP', 'HEDGE', 'HEALTH', 'SOCIAL',
    'ADMIN', 'RECOVERY', 'MEETING', 'COMMUTE', 'LEARNING',
    'WRITING', 'ERRANDS'
  ]

  if (validCategories.includes(upper as AgendaCategory)) {
    return upper as AgendaCategory
  }

  // Try to map common variations
  const mappings: Record<string, AgendaCategory> = {
    'WORK': 'META',
    'EXERCISE': 'HEALTH',
    'WORKOUT': 'HEALTH',
    'FOCUS': 'META',
    'DEEP_WORK': 'META',
    'REST': 'RECOVERY',
    'BREAK': 'RECOVERY',
    'TRAVEL': 'COMMUTE',
    'STUDY': 'LEARNING',
  }

  return mappings[upper] || null
}
