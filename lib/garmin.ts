import { GarminConnect } from 'garmin-connect'
import fs from 'fs'
import path from 'path'

// Singleton client instance
let client: InstanceType<typeof GarminConnect> | null = null
let lastLogin: number = 0
const LOGIN_INTERVAL = 30 * 60 * 1000 // Re-login every 30 minutes

// Token storage path (in project root, gitignored)
const TOKEN_DIR = path.join(process.cwd(), '.garmin-tokens')

/**
 * Get or create a Garmin Connect client
 */
async function getClient(): Promise<InstanceType<typeof GarminConnect> | null> {
  const email = process.env.GARMIN_EMAIL
  const password = process.env.GARMIN_PASSWORD

  if (!email || !password) {
    console.log('[Garmin] No credentials configured')
    return null
  }

  const now = Date.now()

  // Return existing client if still valid
  if (client && now - lastLogin < LOGIN_INTERVAL) {
    return client
  }

  try {
    client = new GarminConnect({
      username: email,
      password: password,
    })

    // Try to load saved tokens first
    if (fs.existsSync(TOKEN_DIR)) {
      try {
        client.loadTokenByFile(TOKEN_DIR)
        console.log('[Garmin] Loaded saved tokens')
        lastLogin = now
        return client
      } catch {
        console.log('[Garmin] Saved tokens expired, logging in fresh')
      }
    }

    // Fresh login
    await client.login()
    lastLogin = now

    // Save tokens for reuse
    if (!fs.existsSync(TOKEN_DIR)) {
      fs.mkdirSync(TOKEN_DIR, { recursive: true })
    }
    client.exportTokenToFile(TOKEN_DIR)
    console.log('[Garmin] Logged in and saved tokens')

    return client
  } catch (error) {
    console.error('[Garmin] Login failed:', error)
    client = null
    return null
  }
}

/**
 * Check if Garmin is configured
 */
export function isGarminConfigured(): boolean {
  return !!(process.env.GARMIN_EMAIL && process.env.GARMIN_PASSWORD)
}

// Types for Garmin data
export interface GarminSleepData {
  dailySleepDTO?: {
    calendarDate: string
    sleepTimeSeconds: number
    napTimeSeconds: number
    deepSleepSeconds: number
    lightSleepSeconds: number
    remSleepSeconds: number
    awakeSleepSeconds: number
    sleepScores?: {
      overall?: { value: number }
      qualityScore?: number
    }
  }
  sleepLevels?: Array<{
    startGMT: string
    endGMT: string
    activityLevel: number
  }>
}

export interface GarminHeartRate {
  restingHeartRate: number
  maxHeartRate: number
  minHeartRate: number
  heartRateValues?: Array<[number, number]>
}

export interface GarminDailySummary {
  steps: number
  totalDistanceMeters: number
  activeTimeSeconds: number
  floorsClimbed: number
  restingHeartRate: number
  stressLevel?: number
  bodyBattery?: {
    highest: number
    lowest: number
    charged: number
    drained: number
  }
}

/**
 * Get sleep data for a specific date
 */
export async function getGarminSleep(date?: Date): Promise<GarminSleepData | null> {
  const gc = await getClient()
  if (!gc) return null

  try {
    const sleepData = await gc.getSleepData(date)
    return sleepData as GarminSleepData
  } catch (error) {
    console.error('[Garmin] Error getting sleep data:', error)
    return null
  }
}

/**
 * Get heart rate data for a specific date
 */
export async function getGarminHeartRate(date?: Date): Promise<GarminHeartRate | null> {
  const gc = await getClient()
  if (!gc) return null

  try {
    const hrData = await gc.getHeartRate(date)
    return hrData as GarminHeartRate
  } catch (error) {
    console.error('[Garmin] Error getting heart rate:', error)
    return null
  }
}

/**
 * Get daily steps
 */
export async function getGarminSteps(date?: Date): Promise<number | null> {
  const gc = await getClient()
  if (!gc) return null

  try {
    return await gc.getSteps(date)
  } catch (error) {
    console.error('[Garmin] Error getting steps:', error)
    return null
  }
}

/**
 * Get recent activities
 */
export async function getGarminActivities(limit: number = 10): Promise<unknown[]> {
  const gc = await getClient()
  if (!gc) return []

  try {
    return await gc.getActivities(0, limit)
  } catch (error) {
    console.error('[Garmin] Error getting activities:', error)
    return []
  }
}

/**
 * Get daily summary with body battery and stress (custom endpoint)
 */
export async function getGarminDailySummary(date?: Date): Promise<GarminDailySummary | null> {
  const gc = await getClient()
  if (!gc) return null

  try {
    const dateStr = (date || new Date()).toISOString().split('T')[0]

    // Get basic stats
    const [steps, heartRate] = await Promise.all([
      gc.getSteps(date).catch(() => 0),
      gc.getHeartRate(date).catch(() => null),
    ])

    // Try to get body battery via custom endpoint
    let bodyBattery = null
    try {
      const bbData = await gc.get<{ bodyBatteryValuesArray?: number[][] }>(
        `https://connect.garmin.com/modern/proxy/wellness-service/wellness/bodyBattery?date=${dateStr}`
      )
      if (bbData?.bodyBatteryValuesArray && bbData.bodyBatteryValuesArray.length > 0) {
        const values = bbData.bodyBatteryValuesArray.map((v: number[]) => v[1])
        bodyBattery = {
          highest: Math.max(...values),
          lowest: Math.min(...values),
          charged: 0, // Would need additional calculation
          drained: 0,
        }
      }
    } catch {
      // Body battery endpoint may not be available
    }

    return {
      steps: steps || 0,
      totalDistanceMeters: 0,
      activeTimeSeconds: 0,
      floorsClimbed: 0,
      restingHeartRate: (heartRate as GarminHeartRate)?.restingHeartRate || 0,
      bodyBattery: bodyBattery || undefined,
    }
  } catch (error) {
    console.error('[Garmin] Error getting daily summary:', error)
    return null
  }
}

/**
 * Get comprehensive wellness summary for today
 */
export async function getGarminWellnessSummary(): Promise<{
  sleep: GarminSleepData | null
  heartRate: GarminHeartRate | null
  daily: GarminDailySummary | null
  activities: unknown[]
} | null> {
  if (!isGarminConfigured()) {
    return null
  }

  const [sleep, heartRate, daily, activities] = await Promise.all([
    getGarminSleep(),
    getGarminHeartRate(),
    getGarminDailySummary(),
    getGarminActivities(10),
  ])

  return { sleep, heartRate, daily, activities }
}

/**
 * Format Garmin data for LLM context
 */
export function formatGarminForLLM(data: {
  sleep: GarminSleepData | null
  heartRate: GarminHeartRate | null
  daily: GarminDailySummary | null
  activities?: unknown[]
}): string {
  const parts: string[] = []

  if (data.daily) {
    parts.push(`Today's Stats:`)
    parts.push(`- Steps: ${data.daily.steps.toLocaleString()}`)
    if (data.daily.restingHeartRate) {
      parts.push(`- Resting HR: ${data.daily.restingHeartRate} bpm`)
    }
    if (data.daily.bodyBattery) {
      parts.push(`- Body Battery: ${data.daily.bodyBattery.lowest}-${data.daily.bodyBattery.highest}`)
    }
  }

  if (data.sleep?.dailySleepDTO) {
    const s = data.sleep.dailySleepDTO
    const totalHours = (s.sleepTimeSeconds || 0) / 3600
    const deepHours = (s.deepSleepSeconds || 0) / 3600
    const remHours = (s.remSleepSeconds || 0) / 3600

    parts.push(`\nLast Night's Sleep:`)
    parts.push(`- Duration: ${totalHours.toFixed(1)} hours`)
    parts.push(`- Deep: ${deepHours.toFixed(1)}h, REM: ${remHours.toFixed(1)}h`)
    if (s.sleepScores?.overall?.value) {
      parts.push(`- Sleep Score: ${s.sleepScores.overall.value}`)
    }
  }

  if (data.heartRate) {
    parts.push(`\nHeart Rate:`)
    parts.push(`- Resting: ${data.heartRate.restingHeartRate} bpm`)
    parts.push(`- Range: ${data.heartRate.minHeartRate}-${data.heartRate.maxHeartRate} bpm`)
  }

  // Format recent activities/workouts
  if (data.activities && data.activities.length > 0) {
    parts.push(`\nRecent Workouts:`)
    for (const activity of data.activities.slice(0, 10)) {
      const a = activity as {
        activityName?: string
        activityType?: { typeKey?: string }
        startTimeLocal?: string
        duration?: number
        distance?: number
        averageHR?: number
        calories?: number
      }
      const date = a.startTimeLocal ? new Date(a.startTimeLocal).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }) : 'Unknown date'
      const duration = a.duration ? `${Math.round(a.duration / 60)}min` : ''
      const distance = a.distance ? `${(a.distance / 1000).toFixed(1)}km` : ''
      const hr = a.averageHR ? `${a.averageHR}bpm avg` : ''
      const type = a.activityType?.typeKey || 'activity'

      const details = [distance, duration, hr].filter(Boolean).join(', ')
      parts.push(`- ${date}: ${a.activityName || type} (${type}) - ${details}`)
    }
  }

  if (parts.length === 0) {
    return 'No Garmin data available.'
  }

  return parts.join('\n')
}
