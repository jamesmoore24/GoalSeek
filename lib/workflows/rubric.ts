import { createClient } from '@/lib/supabase/server'
import {
  type WorkflowRubric,
  type RubricValidationResult,
  type RubricResult,
  type AgendaItem,
  type PlanMyDayContext,
  type ValidationRule,
} from '@/types/workflow'

// ============================================
// RUBRIC EVALUATION ENGINE
// ============================================

/**
 * Get rubrics for a workflow
 */
export async function getRubricsForWorkflow(
  workflowId: string,
  userId: string
): Promise<WorkflowRubric[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('workflow_rubrics')
    .select('*')
    .eq('workflow_id', workflowId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('category')

  if (error) {
    console.error('[Rubric] Error fetching rubrics:', error)
    return []
  }

  return (data || []) as WorkflowRubric[]
}

/**
 * Create default rubrics for the planmyday workflow
 */
export async function createDefaultPlanmydayRubrics(
  workflowId: string,
  userId: string
): Promise<WorkflowRubric[]> {
  const supabase = await createClient()

  const defaultRubrics: Omit<WorkflowRubric, 'id' | 'created_at' | 'updated_at'>[] = [
    {
      workflow_id: workflowId,
      user_id: userId,
      category: 'health',
      name: 'Morning sunlight exposure',
      description: 'Include outdoor time between 6am-10am for circadian rhythm',
      constraint_type: 'soft',
      validation_rule: {
        type: 'time_window',
        start: '06:00',
        end: '10:00',
        activity: 'outdoor',
      },
      weight: 8,
      is_active: true,
    },
    {
      workflow_id: workflowId,
      user_id: userId,
      category: 'metabolic',
      name: 'Caffeine cutoff',
      description: 'No caffeine activities scheduled within 8 hours of sleep time',
      constraint_type: 'hard',
      validation_rule: {
        type: 'minimum_gap',
        between: 'caffeine',
        and: 'sleep',
        hours: 8,
      },
      weight: 10,
      is_active: true,
    },
    {
      workflow_id: workflowId,
      user_id: userId,
      category: 'sleep',
      name: 'Sleep protection',
      description: 'No high-intensity activities within 2 hours of sleep time',
      constraint_type: 'hard',
      validation_rule: {
        type: 'minimum_gap',
        between: 'high_intensity',
        and: 'sleep',
        hours: 2,
      },
      weight: 10,
      is_active: true,
    },
    {
      workflow_id: workflowId,
      user_id: userId,
      category: 'time',
      name: 'No calendar conflicts',
      description: 'Agenda items must not overlap with existing calendar events',
      constraint_type: 'hard',
      validation_rule: {
        type: 'no_overlap',
        with: 'calendar_events',
      },
      weight: 10,
      is_active: true,
    },
    {
      workflow_id: workflowId,
      user_id: userId,
      category: 'health',
      name: 'Daily movement',
      description: 'Include at least 30 minutes of physical activity',
      constraint_type: 'soft',
      validation_rule: {
        type: 'required_activity',
        activity: 'HEALTH',
        min_duration_minutes: 30,
      },
      weight: 7,
      is_active: true,
    },
    {
      workflow_id: workflowId,
      user_id: userId,
      category: 'productivity',
      name: 'Deep work block',
      description: 'Include at least one 90+ minute focused work block',
      constraint_type: 'soft',
      validation_rule: {
        type: 'min_duration',
        activity: 'deep_work',
        minutes: 90,
      },
      weight: 6,
      is_active: true,
    },
    {
      workflow_id: workflowId,
      user_id: userId,
      category: 'social',
      name: 'Social time',
      description: 'Include some social or relationship time',
      constraint_type: 'soft',
      validation_rule: {
        type: 'required_activity',
        activity: 'SOCIAL',
        min_duration_minutes: 15,
      },
      weight: 4,
      is_active: true,
    },
  ]

  const { data, error } = await supabase
    .from('workflow_rubrics')
    .insert(defaultRubrics)
    .select()

  if (error) {
    console.error('[Rubric] Error creating default rubrics:', error)
    return []
  }

  return (data || []) as WorkflowRubric[]
}

/**
 * Evaluate agenda against rubrics
 */
export function evaluateRubrics(
  agenda: AgendaItem[],
  context: PlanMyDayContext,
  rubrics: WorkflowRubric[]
): RubricValidationResult {
  const results: RubricResult[] = []
  let totalWeight = 0
  let earnedScore = 0
  let allHardPassed = true

  for (const rubric of rubrics) {
    const result = evaluateSingleRubric(rubric, agenda, context)
    results.push(result)

    if (rubric.constraint_type === 'hard') {
      if (!result.passed) {
        allHardPassed = false
      }
    } else {
      // Soft constraint - contributes to score
      totalWeight += rubric.weight
      if (result.passed) {
        earnedScore += rubric.weight * (result.score / 100)
      } else {
        earnedScore += rubric.weight * (result.score / 100)
      }
    }
  }

  const softScore = totalWeight > 0 ? Math.round((earnedScore / totalWeight) * 100) : 100
  const overallScore = allHardPassed ? softScore : Math.min(softScore, 50) // Cap at 50 if hard constraints fail

  // Generate suggestions for failed rubrics
  const suggestions = results
    .filter(r => !r.passed)
    .map(r => r.message || `Fix: ${r.name}`)

  return {
    overall_score: overallScore,
    passed: allHardPassed && overallScore >= 70,
    hard_constraints_passed: allHardPassed,
    soft_constraints_score: softScore,
    results,
    suggestions,
  }
}

/**
 * Evaluate a single rubric against the agenda
 */
function evaluateSingleRubric(
  rubric: WorkflowRubric,
  agenda: AgendaItem[],
  context: PlanMyDayContext
): RubricResult {
  const rule = rubric.validation_rule

  try {
    switch (rule.type) {
      case 'time_window':
        return evaluateTimeWindow(rubric, rule, agenda, context)

      case 'no_overlap':
        return evaluateNoOverlap(rubric, rule, agenda, context)

      case 'minimum_gap':
        return evaluateMinimumGap(rubric, rule, agenda, context)

      case 'required_activity':
        return evaluateRequiredActivity(rubric, rule, agenda)

      case 'min_duration':
        return evaluateMinDuration(rubric, rule, agenda)

      case 'max_duration':
        return evaluateMaxDuration(rubric, rule, agenda)

      case 'custom':
        return evaluateCustomRule(rubric, rule, agenda, context)

      default:
        return {
          rubric_id: rubric.id,
          name: rubric.name,
          category: rubric.category,
          constraint_type: rubric.constraint_type,
          passed: true,
          score: 100,
          message: 'Unknown rule type - skipped',
        }
    }
  } catch (error) {
    console.error(`[Rubric] Error evaluating ${rubric.name}:`, error)
    return {
      rubric_id: rubric.id,
      name: rubric.name,
      category: rubric.category,
      constraint_type: rubric.constraint_type,
      passed: false,
      score: 0,
      message: `Evaluation error: ${error instanceof Error ? error.message : 'Unknown'}`,
    }
  }
}

/**
 * Evaluate time window rule (e.g., outdoor activity between 6am-10am)
 */
function evaluateTimeWindow(
  rubric: WorkflowRubric,
  rule: ValidationRule & { type: 'time_window' },
  agenda: AgendaItem[],
  context: PlanMyDayContext
): RubricResult {
  const { start, end, activity } = rule

  // Find matching activities in the time window
  const matchingItems = agenda.filter(item => {
    // Check if activity matches
    const activityMatches = !activity ||
      item.category?.toLowerCase().includes(activity.toLowerCase()) ||
      item.location?.toLowerCase().includes(activity.toLowerCase()) ||
      item.title.toLowerCase().includes(activity.toLowerCase())

    if (!activityMatches) return false

    // Check if time is within window
    const itemStart = parseTime(item.start_time)
    const windowStart = parseTime(start)
    const windowEnd = parseTime(end)

    return itemStart >= windowStart && itemStart <= windowEnd
  })

  const passed = matchingItems.length > 0
  const score = passed ? 100 : 0

  return {
    rubric_id: rubric.id,
    name: rubric.name,
    category: rubric.category,
    constraint_type: rubric.constraint_type,
    passed,
    score,
    message: passed
      ? `Found ${matchingItems.length} ${activity || 'activity'} in ${start}-${end} window`
      : `No ${activity || 'activity'} scheduled between ${start} and ${end}`,
    details: { matching_items: matchingItems.map(i => i.title) },
  }
}

/**
 * Evaluate no overlap rule (e.g., no overlap with calendar events)
 */
function evaluateNoOverlap(
  rubric: WorkflowRubric,
  rule: ValidationRule & { type: 'no_overlap' },
  agenda: AgendaItem[],
  context: PlanMyDayContext
): RubricResult {
  const overlaps: string[] = []

  for (const item of agenda) {
    const itemStart = parseTime(item.start_time)
    const itemEnd = parseTime(item.end_time)

    if (rule.with === 'calendar_events') {
      for (const event of context.calendar_events) {
        const eventStart = new Date(event.start).getHours() * 60 + new Date(event.start).getMinutes()
        const eventEnd = new Date(event.end).getHours() * 60 + new Date(event.end).getMinutes()

        // Check for overlap
        if (itemStart < eventEnd && itemEnd > eventStart) {
          overlaps.push(`${item.title} overlaps with ${event.title}`)
        }
      }
    } else if (rule.with === 'sleep_time') {
      const sleepStart = parseTime(context.profile.sleep_time)
      if (itemEnd > sleepStart || itemStart > sleepStart) {
        overlaps.push(`${item.title} extends into sleep time`)
      }
    }
  }

  const passed = overlaps.length === 0
  const score = passed ? 100 : Math.max(0, 100 - overlaps.length * 20)

  return {
    rubric_id: rubric.id,
    name: rubric.name,
    category: rubric.category,
    constraint_type: rubric.constraint_type,
    passed,
    score,
    message: passed
      ? `No conflicts with ${rule.with}`
      : `${overlaps.length} conflict(s) detected`,
    details: { overlaps },
  }
}

/**
 * Evaluate minimum gap rule (e.g., 8 hours between caffeine and sleep)
 */
function evaluateMinimumGap(
  rubric: WorkflowRubric,
  rule: ValidationRule & { type: 'minimum_gap' },
  agenda: AgendaItem[],
  context: PlanMyDayContext
): RubricResult {
  const { between, and: andActivity, hours } = rule
  const requiredGapMinutes = hours * 60

  // Find the reference time
  let referenceTime: number

  if (andActivity === 'sleep') {
    referenceTime = parseTime(context.profile.sleep_time)
  } else {
    // Find the latest matching activity
    const matchingItems = agenda.filter(item =>
      item.category?.toLowerCase().includes(andActivity.toLowerCase()) ||
      item.title.toLowerCase().includes(andActivity.toLowerCase())
    )

    if (matchingItems.length === 0) {
      return {
        rubric_id: rubric.id,
        name: rubric.name,
        category: rubric.category,
        constraint_type: rubric.constraint_type,
        passed: true,
        score: 100,
        message: `No ${andActivity} activities found`,
      }
    }

    referenceTime = Math.max(...matchingItems.map(i => parseTime(i.end_time)))
  }

  // Find activities that should have a gap
  const violatingItems: string[] = []

  for (const item of agenda) {
    const matchesBetween =
      item.category?.toLowerCase().includes(between.toLowerCase()) ||
      item.title.toLowerCase().includes(between.toLowerCase()) ||
      (between === 'high_intensity' && item.intensity === 'high') ||
      (between === 'caffeine' && (
        item.title.toLowerCase().includes('coffee') ||
        item.title.toLowerCase().includes('caffeine') ||
        item.title.toLowerCase().includes('tea')
      ))

    if (matchesBetween) {
      const itemEnd = parseTime(item.end_time)
      const gap = referenceTime - itemEnd

      if (gap < requiredGapMinutes && gap >= 0) {
        violatingItems.push(`${item.title} ends ${Math.round(gap / 60 * 10) / 10}h before ${andActivity}`)
      }
    }
  }

  const passed = violatingItems.length === 0
  const score = passed ? 100 : 0

  return {
    rubric_id: rubric.id,
    name: rubric.name,
    category: rubric.category,
    constraint_type: rubric.constraint_type,
    passed,
    score,
    message: passed
      ? `${hours}h gap between ${between} and ${andActivity} maintained`
      : `${between} activities too close to ${andActivity}`,
    details: { violations: violatingItems },
  }
}

/**
 * Evaluate required activity rule
 */
function evaluateRequiredActivity(
  rubric: WorkflowRubric,
  rule: ValidationRule & { type: 'required_activity' },
  agenda: AgendaItem[]
): RubricResult {
  const { activity, min_duration_minutes } = rule

  // Find matching activities
  const matchingItems = agenda.filter(item =>
    item.category === activity ||
    item.title.toLowerCase().includes(activity.toLowerCase())
  )

  // Calculate total duration
  let totalMinutes = 0
  for (const item of matchingItems) {
    const start = parseTime(item.start_time)
    const end = parseTime(item.end_time)
    totalMinutes += end - start
  }

  const minRequired = min_duration_minutes || 0
  const passed = totalMinutes >= minRequired
  const score = minRequired > 0
    ? Math.min(100, Math.round((totalMinutes / minRequired) * 100))
    : (matchingItems.length > 0 ? 100 : 0)

  return {
    rubric_id: rubric.id,
    name: rubric.name,
    category: rubric.category,
    constraint_type: rubric.constraint_type,
    passed,
    score,
    message: passed
      ? `${activity}: ${totalMinutes} minutes scheduled`
      : `${activity}: only ${totalMinutes}/${minRequired} minutes scheduled`,
    details: { total_minutes: totalMinutes, items: matchingItems.map(i => i.title) },
  }
}

/**
 * Evaluate minimum duration rule
 */
function evaluateMinDuration(
  rubric: WorkflowRubric,
  rule: ValidationRule & { type: 'min_duration' },
  agenda: AgendaItem[]
): RubricResult {
  const { activity, minutes: minMinutes } = rule

  // Find matching activities
  const matchingItems = agenda.filter(item =>
    item.category?.toLowerCase().includes(activity.toLowerCase()) ||
    item.title.toLowerCase().includes(activity.toLowerCase()) ||
    (activity === 'deep_work' && (
      item.category === 'META' ||
      item.category === 'STARTUP' ||
      item.category === 'LEARNING' ||
      item.category === 'WRITING'
    ))
  )

  // Check if any single block meets minimum duration
  let longestBlock = 0
  for (const item of matchingItems) {
    const start = parseTime(item.start_time)
    const end = parseTime(item.end_time)
    const duration = end - start
    longestBlock = Math.max(longestBlock, duration)
  }

  const passed = longestBlock >= minMinutes
  const score = Math.min(100, Math.round((longestBlock / minMinutes) * 100))

  return {
    rubric_id: rubric.id,
    name: rubric.name,
    category: rubric.category,
    constraint_type: rubric.constraint_type,
    passed,
    score,
    message: passed
      ? `Longest ${activity} block: ${longestBlock} minutes`
      : `No ${activity} block >= ${minMinutes} minutes (longest: ${longestBlock}m)`,
    details: { longest_block: longestBlock, items: matchingItems.map(i => i.title) },
  }
}

/**
 * Evaluate maximum duration rule
 */
function evaluateMaxDuration(
  rubric: WorkflowRubric,
  rule: ValidationRule & { type: 'max_duration' },
  agenda: AgendaItem[]
): RubricResult {
  const { activity, minutes: maxMinutes } = rule

  // Find matching activities
  const matchingItems = agenda.filter(item =>
    item.category?.toLowerCase().includes(activity.toLowerCase()) ||
    item.title.toLowerCase().includes(activity.toLowerCase())
  )

  // Check if any block exceeds maximum duration
  const violations: string[] = []
  for (const item of matchingItems) {
    const start = parseTime(item.start_time)
    const end = parseTime(item.end_time)
    const duration = end - start
    if (duration > maxMinutes) {
      violations.push(`${item.title}: ${duration} minutes`)
    }
  }

  const passed = violations.length === 0
  const score = passed ? 100 : Math.max(0, 100 - violations.length * 25)

  return {
    rubric_id: rubric.id,
    name: rubric.name,
    category: rubric.category,
    constraint_type: rubric.constraint_type,
    passed,
    score,
    message: passed
      ? `All ${activity} blocks under ${maxMinutes} minutes`
      : `${violations.length} ${activity} block(s) exceed ${maxMinutes} minutes`,
    details: { violations },
  }
}

/**
 * Evaluate custom rule (placeholder for user-defined functions)
 */
function evaluateCustomRule(
  rubric: WorkflowRubric,
  rule: ValidationRule & { type: 'custom' },
  agenda: AgendaItem[],
  context: PlanMyDayContext
): RubricResult {
  // Custom rules would call user-defined validation functions
  // For now, just pass
  return {
    rubric_id: rubric.id,
    name: rubric.name,
    category: rubric.category,
    constraint_type: rubric.constraint_type,
    passed: true,
    score: 100,
    message: `Custom rule '${rule.function}' not implemented`,
  }
}

/**
 * Parse time string (HH:mm) to minutes since midnight
 */
function parseTime(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + (minutes || 0)
}
