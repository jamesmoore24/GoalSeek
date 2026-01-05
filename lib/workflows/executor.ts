import { createClient } from '@/lib/supabase/server'
import {
  getGoogleCalendarEvents,
  getFreeBusyTime,
  createCalendarEvent,
  type CreateEventParams,
} from '@/lib/google-calendar'
import {
  type Workflow,
  type WorkflowExecution,
  type WorkflowStep,
  type StepResult,
  type PlanMyDayContext,
  type AgendaItem,
  type AgendaProposal,
  type RubricValidationResult,
  type ExecutionStatus,
} from '@/types/workflow'
import { evaluateRubrics, getRubricsForWorkflow } from './rubric'
import { generateAgendaWithLLM } from './llm'

// ============================================
// WORKFLOW EXECUTOR
// ============================================

export interface ExecutorOptions {
  userId: string
  workflowId?: string
  workflowSlug?: string
  inputData?: Record<string, unknown>
  targetDate?: string // For /planmyday - ISO date string
}

export interface ExecutorResult {
  execution: WorkflowExecution
  proposal?: AgendaProposal
  error?: string
}

/**
 * Main workflow executor class
 */
export class WorkflowExecutor {
  private userId: string
  private workflow: Workflow | null = null
  private execution: WorkflowExecution | null = null
  private context: PlanMyDayContext | null = null

  constructor(private options: ExecutorOptions) {
    this.userId = options.userId
  }

  /**
   * Execute the workflow
   */
  async execute(): Promise<ExecutorResult> {
    try {
      // 1. Load the workflow
      await this.loadWorkflow()
      if (!this.workflow) {
        throw new Error('Workflow not found')
      }

      // 2. Create execution record
      await this.createExecution()
      if (!this.execution) {
        throw new Error('Failed to create execution')
      }

      // 3. Execute steps
      await this.updateExecutionStatus('running')

      for (let i = 0; i < this.workflow.steps.length; i++) {
        const step = this.workflow.steps[i]
        const result = await this.executeStep(i, step)

        if (result.status === 'failed') {
          await this.handleStepFailure(i, result.error || 'Unknown error')
          return {
            execution: this.execution,
            error: result.error,
          }
        }

        // If step requires user interaction, pause execution
        if (step.type === 'user_interaction') {
          await this.updateExecutionStatus('awaiting_user')
          return {
            execution: this.execution,
            proposal: this.execution.pending_proposal || undefined,
          }
        }
      }

      // 4. Complete execution
      await this.updateExecutionStatus('completed')

      return {
        execution: this.execution,
        proposal: this.execution.pending_proposal || undefined,
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[Workflow Executor] Error:', errorMessage)

      if (this.execution) {
        await this.handleStepFailure(this.execution.current_step, errorMessage)
      }

      return {
        execution: this.execution!,
        error: errorMessage,
      }
    }
  }

  /**
   * Resume execution after user feedback
   */
  async resume(feedback: string, action: 'approve' | 'reject' | 'iterate'): Promise<ExecutorResult> {
    if (!this.execution) {
      throw new Error('No execution to resume')
    }

    const supabase = await createClient()

    // Add feedback to execution
    const updatedFeedback = [...(this.execution.user_feedback || []), feedback]

    if (action === 'approve') {
      // User approved - continue to write output
      await this.updateExecutionStatus('running')

      // Find and execute remaining steps
      const currentStep = this.execution.current_step
      if (!this.workflow) {
        await this.loadWorkflow()
      }

      for (let i = currentStep + 1; i < this.workflow!.steps.length; i++) {
        const step = this.workflow!.steps[i]
        const result = await this.executeStep(i, step)

        if (result.status === 'failed') {
          await this.handleStepFailure(i, result.error || 'Unknown error')
          return {
            execution: this.execution,
            error: result.error,
          }
        }
      }

      await this.updateExecutionStatus('completed')
      return {
        execution: this.execution,
        proposal: this.execution.pending_proposal || undefined,
      }

    } else if (action === 'iterate') {
      // User wants changes - regenerate
      const newIteration = this.execution.iteration_count + 1

      await supabase
        .from('workflow_executions')
        .update({
          user_feedback: updatedFeedback,
          iteration_count: newIteration,
          status: 'running',
        })
        .eq('id', this.execution.id)

      this.execution.user_feedback = updatedFeedback
      this.execution.iteration_count = newIteration

      // Re-execute from the beginning to rebuild context, then analyze
      if (!this.workflow) {
        await this.loadWorkflow()
      }

      // We need to re-fetch all data to rebuild context before analyzing
      // Start from step 0 to ensure context is properly initialized
      for (let i = 0; i < this.workflow!.steps.length; i++) {
        const step = this.workflow!.steps[i]
        const result = await this.executeStep(i, step)

        if (result.status === 'failed') {
          await this.handleStepFailure(i, result.error || 'Unknown error')
          return { execution: this.execution, error: result.error }
        }

        if (step.type === 'user_interaction') {
          await this.updateExecutionStatus('awaiting_user')
          return {
            execution: this.execution,
            proposal: this.execution.pending_proposal || undefined,
          }
        }
      }

      await this.updateExecutionStatus('completed')
      return { execution: this.execution }

    } else {
      // Rejected
      await this.updateExecutionStatus('cancelled')
      return { execution: this.execution }
    }
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private async loadWorkflow(): Promise<void> {
    const supabase = await createClient()

    let query = supabase
      .from('workflows')
      .select('*')
      .eq('user_id', this.userId)
      .eq('is_active', true)

    if (this.options.workflowId) {
      query = query.eq('id', this.options.workflowId)
    } else if (this.options.workflowSlug) {
      query = query.eq('slug', this.options.workflowSlug)
    } else {
      throw new Error('Either workflowId or workflowSlug is required')
    }

    const { data, error } = await query.single()

    if (error || !data) {
      // Check for system workflows (planmyday)
      if (this.options.workflowSlug === 'planmyday') {
        this.workflow = await this.createSystemWorkflow('planmyday')
        return
      }
      throw new Error(`Workflow not found: ${error?.message || 'No data'}`)
    }

    this.workflow = data as Workflow
  }

  private async createSystemWorkflow(slug: string): Promise<Workflow> {
    if (slug !== 'planmyday') {
      throw new Error(`Unknown system workflow: ${slug}`)
    }

    // Create planmyday workflow for user if it doesn't exist
    const supabase = await createClient()

    const planmydaySteps: WorkflowStep[] = [
      {
        type: 'fetch_data',
        name: 'Fetch Calendar',
        config: {
          source: 'calendar',
          date_range: { start: 'today', end: 'today' },
        },
      },
      {
        type: 'fetch_data',
        name: 'Fetch Memories',
        config: {
          source: 'memories',
          limit: 10,
        },
      },
      {
        type: 'fetch_data',
        name: 'Fetch Pursuits',
        config: {
          source: 'pursuits',
        },
      },
      {
        type: 'analyze',
        name: 'Generate Agenda',
        config: {
          prompt_template: 'planmyday',
          temperature: 0.7,
          max_tokens: 4000,
        },
      },
      {
        type: 'validate_rubric',
        name: 'Validate Against Rubrics',
        config: {
          min_score: 70,
          max_iterations: 3,
        },
      },
      {
        type: 'user_interaction',
        name: 'Propose Agenda',
        config: {
          interaction_type: 'proposal',
        },
      },
      {
        type: 'write_output',
        name: 'Sync to Calendar',
        config: {
          destination: 'calendar',
        },
      },
    ]

    const { data, error } = await supabase
      .from('workflows')
      .insert({
        user_id: this.userId,
        name: 'Plan My Day',
        slug: 'planmyday',
        description: 'Generate an optimized daily agenda based on your calendar, goals, and constraints',
        is_system: true,
        is_active: true,
        steps: planmydaySteps,
        enabled_integrations: ['calendar', 'memories', 'pursuits'],
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create system workflow: ${error.message}`)
    }

    return data as Workflow
  }

  private async createExecution(): Promise<void> {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('workflow_executions')
      .insert({
        workflow_id: this.workflow!.id,
        user_id: this.userId,
        status: 'pending',
        input_data: this.options.inputData || { target_date: this.options.targetDate },
        current_step: 0,
        step_results: [],
        user_feedback: [],
        iteration_count: 0,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create execution: ${error.message}`)
    }

    this.execution = data as WorkflowExecution
  }

  private async executeStep(index: number, step: WorkflowStep): Promise<StepResult> {
    const startedAt = new Date().toISOString()

    try {
      let data: unknown

      switch (step.type) {
        case 'fetch_data':
          data = await this.executeFetchData(step)
          break
        case 'analyze':
          data = await this.executeAnalyze(step)
          break
        case 'validate_rubric':
          data = await this.executeValidateRubric(step)
          break
        case 'user_interaction':
          data = await this.executeUserInteraction(step)
          break
        case 'write_output':
          data = await this.executeWriteOutput(step)
          break
        default:
          throw new Error(`Unknown step type: ${step.type}`)
      }

      const result: StepResult = {
        step_index: index,
        step_type: step.type,
        status: 'success',
        data,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
      }

      await this.saveStepResult(index, result)
      return result

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const result: StepResult = {
        step_index: index,
        step_type: step.type,
        status: 'failed',
        error: errorMessage,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
      }

      await this.saveStepResult(index, result)
      return result
    }
  }

  private async executeFetchData(step: WorkflowStep): Promise<unknown> {
    const config = step.config
    const targetDate = this.options.targetDate || new Date().toISOString().split('T')[0]

    switch (config.source) {
      case 'calendar': {
        const startDate = new Date(targetDate)
        startDate.setHours(0, 0, 0, 0)
        const endDate = new Date(targetDate)
        endDate.setHours(23, 59, 59, 999)

        const events = await getGoogleCalendarEvents(this.userId, {
          startDate,
          endDate,
        })

        const busySlots = await getFreeBusyTime(this.userId, startDate, endDate)

        // Initialize or update context
        if (!this.context) {
          this.context = await this.initializeContext(targetDate)
        }

        this.context.calendar_events = events.map(e => ({
          id: e.id,
          title: e.title,
          start: e.start.toISOString(),
          end: e.end.toISOString(),
          location: e.location,
          is_all_day: e.isAllDay,
        }))

        this.context.busy_slots = busySlots.map(s => ({
          start: s.start.toISOString(),
          end: s.end.toISOString(),
        }))

        return { events, busySlots }
      }

      case 'memories': {
        const supabase = await createClient()
        const { data: memories } = await supabase
          .from('user_memories')
          .select('id, content, memory_type, importance')
          .eq('user_id', this.userId)
          .order('importance', { ascending: false })
          .limit(config.limit || 10)

        if (!this.context) {
          this.context = await this.initializeContext(targetDate)
        }

        this.context.memories = (memories || []).map(m => ({
          id: m.id,
          content: m.content,
          type: m.memory_type,
          importance: m.importance,
        }))

        return memories
      }

      case 'pursuits': {
        const supabase = await createClient()

        // Get pursuits
        const { data: pursuits } = await supabase
          .from('pursuits')
          .select('id, name, weekly_hours_target, status')
          .eq('user_id', this.userId)
          .eq('status', 'active')

        // Get this week's logged hours
        const startOfWeek = new Date(targetDate)
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
        startOfWeek.setHours(0, 0, 0, 0)

        const { data: logs } = await supabase
          .from('day_logs')
          .select('pursuit_id, duration_minutes')
          .eq('user_id', this.userId)
          .gte('logged_at', startOfWeek.toISOString())

        // Calculate hours logged per pursuit
        const hoursMap = new Map<string, number>()
        for (const log of logs || []) {
          if (log.pursuit_id) {
            const current = hoursMap.get(log.pursuit_id) || 0
            hoursMap.set(log.pursuit_id, current + (log.duration_minutes / 60))
          }
        }

        if (!this.context) {
          this.context = await this.initializeContext(targetDate)
        }

        this.context.pursuits = (pursuits || []).map(p => ({
          id: p.id,
          name: p.name,
          weekly_hours_target: p.weekly_hours_target,
          hours_logged_this_week: hoursMap.get(p.id) || 0,
          status: p.status,
        }))

        return { pursuits, hours_logged: Object.fromEntries(hoursMap) }
      }

      case 'profile': {
        const supabase = await createClient()
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', this.userId)
          .single()

        if (!this.context) {
          this.context = await this.initializeContext(targetDate)
        }

        if (profile) {
          this.context.profile = {
            timezone: profile.timezone || 'America/Los_Angeles',
            day_start_time: profile.day_start_time || '07:00',
            day_end_time: profile.day_end_time || '22:00',
            sleep_time: profile.sleep_time || '23:00',
            wake_time: profile.wake_time || '07:00',
            caffeine_cutoff_hours: profile.caffeine_cutoff_hours || 8,
            morning_sunlight_minutes: profile.morning_sunlight_minutes || 15,
            preferred_workout_time: profile.preferred_workout_time || 'morning',
          }
        }

        return profile
      }

      default:
        throw new Error(`Unknown data source: ${config.source}`)
    }
  }

  private async executeAnalyze(step: WorkflowStep): Promise<unknown> {
    if (!this.context) {
      throw new Error('Context not initialized')
    }

    // Get user feedback from previous iterations
    const feedback = this.execution?.user_feedback || []

    // Generate agenda using LLM
    const agenda = await generateAgendaWithLLM(this.context, feedback)

    // Store in execution
    const supabase = await createClient()
    await supabase
      .from('workflow_executions')
      .update({ output_data: { agenda } })
      .eq('id', this.execution!.id)

    this.execution!.output_data = { agenda }

    return agenda
  }

  private async executeValidateRubric(step: WorkflowStep): Promise<RubricValidationResult> {
    const config = step.config
    const minScore = config.min_score || 70
    const maxIterations = config.max_iterations || 3

    // Get rubrics for this workflow
    const rubrics = await getRubricsForWorkflow(this.workflow!.id, this.userId)

    if (!this.context) {
      throw new Error('Context not initialized')
    }

    // Get current agenda from execution output
    const agenda = (this.execution?.output_data as { agenda?: AgendaItem[] })?.agenda
    if (!agenda) {
      throw new Error('No agenda to validate')
    }

    // Evaluate against rubrics
    const result = evaluateRubrics(agenda, this.context, rubrics)

    // Store rubric results
    const supabase = await createClient()
    await supabase
      .from('workflow_executions')
      .update({ rubric_results: result })
      .eq('id', this.execution!.id)

    this.execution!.rubric_results = result

    // Check if we need to iterate
    if (!result.passed && this.execution!.iteration_count < maxIterations) {
      // Generate suggestions and re-analyze
      const analyzeStep = this.workflow!.steps.find(s => s.type === 'analyze')
      if (analyzeStep) {
        // Add rubric feedback to context
        const suggestions = result.suggestions || []
        this.execution!.user_feedback = [
          ...this.execution!.user_feedback,
          `[Rubric Feedback] Score: ${result.overall_score}. Issues: ${suggestions.join('; ')}`,
        ]

        // Re-execute analyze step
        await this.executeAnalyze(analyzeStep)

        // Increment iteration
        await supabase
          .from('workflow_executions')
          .update({
            iteration_count: this.execution!.iteration_count + 1,
            user_feedback: this.execution!.user_feedback,
          })
          .eq('id', this.execution!.id)

        // Re-validate
        return this.executeValidateRubric(step)
      }
    }

    return result
  }

  private async executeUserInteraction(step: WorkflowStep): Promise<unknown> {
    // Build proposal from current execution state
    const agenda = (this.execution?.output_data as { agenda?: AgendaItem[] })?.agenda || []
    const rubricResults = this.execution?.rubric_results

    const proposal: AgendaProposal = {
      date: this.options.targetDate || new Date().toISOString().split('T')[0],
      items: agenda,
      rubric_score: rubricResults?.overall_score || 0,
      rubric_details: rubricResults || {
        overall_score: 0,
        passed: false,
        hard_constraints_passed: false,
        soft_constraints_score: 0,
        results: [],
      },
      summary: this.generateProposalSummary(agenda),
      suggestions: rubricResults?.suggestions,
    }

    // Store pending proposal
    const supabase = await createClient()
    await supabase
      .from('workflow_executions')
      .update({ pending_proposal: proposal })
      .eq('id', this.execution!.id)

    this.execution!.pending_proposal = proposal

    return proposal
  }

  private async executeWriteOutput(step: WorkflowStep): Promise<unknown> {
    const config = step.config
    const proposal = this.execution?.pending_proposal

    if (!proposal) {
      throw new Error('No proposal to write')
    }

    if (config.destination === 'calendar') {
      // Create calendar events for approved agenda items
      const createdEvents: Array<{ agendaItemId: string; eventId: string }> = []
      const supabase = await createClient()

      for (const item of proposal.items) {
        if (item.status === 'approved' || item.status === 'proposed') {
          const date = item.date
          const [startHour, startMin] = item.start_time.split(':').map(Number)
          const [endHour, endMin] = item.end_time.split(':').map(Number)

          const startTime = new Date(date)
          startTime.setHours(startHour, startMin, 0, 0)

          const endTime = new Date(date)
          endTime.setHours(endHour, endMin, 0, 0)

          const params: CreateEventParams = {
            title: item.title,
            startTime,
            endTime,
            description: item.description || undefined,
            location: item.location || undefined,
          }

          try {
            const event = await createCalendarEvent(this.userId, params)
            if (event) {
              createdEvents.push({
                agendaItemId: item.id,
                eventId: event.id,
              })

              // Update agenda item with google_event_id
              await supabase
                .from('agenda_items')
                .update({
                  google_event_id: event.id,
                  synced_at: new Date().toISOString(),
                  status: 'synced',
                })
                .eq('id', item.id)
            }
          } catch (error) {
            console.error(`Failed to create calendar event for ${item.title}:`, error)
          }
        }
      }

      return { created_events: createdEvents }
    }

    return { destination: config.destination, status: 'completed' }
  }

  private async initializeContext(targetDate: string): Promise<PlanMyDayContext> {
    const supabase = await createClient()

    // Get profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', this.userId)
      .single()

    return {
      date: targetDate,
      profile: {
        timezone: profile?.timezone || 'America/Los_Angeles',
        day_start_time: profile?.day_start_time || '07:00',
        day_end_time: profile?.day_end_time || '22:00',
        sleep_time: profile?.sleep_time || '23:00',
        wake_time: profile?.wake_time || '07:00',
        caffeine_cutoff_hours: profile?.caffeine_cutoff_hours || 8,
        morning_sunlight_minutes: profile?.morning_sunlight_minutes || 15,
        preferred_workout_time: profile?.preferred_workout_time || 'morning',
      },
      calendar_events: [],
      busy_slots: [],
      pursuits: [],
      memories: [],
      rubrics: [],
    }
  }

  private async saveStepResult(index: number, result: StepResult): Promise<void> {
    const supabase = await createClient()

    const currentResults = this.execution?.step_results || []
    currentResults[index] = result

    await supabase
      .from('workflow_executions')
      .update({
        current_step: index,
        step_results: currentResults,
      })
      .eq('id', this.execution!.id)

    this.execution!.current_step = index
    this.execution!.step_results = currentResults
  }

  private async updateExecutionStatus(status: ExecutionStatus): Promise<void> {
    const supabase = await createClient()

    const updates: Partial<WorkflowExecution> = { status }

    if (status === 'running' && !this.execution?.started_at) {
      updates.started_at = new Date().toISOString()
    }

    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      updates.completed_at = new Date().toISOString()
    }

    await supabase
      .from('workflow_executions')
      .update(updates)
      .eq('id', this.execution!.id)

    Object.assign(this.execution!, updates)
  }

  private async handleStepFailure(stepIndex: number, errorMessage: string): Promise<void> {
    const supabase = await createClient()

    await supabase
      .from('workflow_executions')
      .update({
        status: 'failed',
        error_message: errorMessage,
        error_step: stepIndex,
        completed_at: new Date().toISOString(),
      })
      .eq('id', this.execution!.id)

    this.execution!.status = 'failed'
    this.execution!.error_message = errorMessage
    this.execution!.error_step = stepIndex
  }

  private generateProposalSummary(agenda: AgendaItem[]): string {
    if (agenda.length === 0) {
      return 'No agenda items generated.'
    }

    const categories = new Map<string, number>()
    let totalMinutes = 0

    for (const item of agenda) {
      const [startH, startM] = item.start_time.split(':').map(Number)
      const [endH, endM] = item.end_time.split(':').map(Number)
      const duration = (endH * 60 + endM) - (startH * 60 + startM)
      totalMinutes += duration

      const cat = item.category || 'Other'
      categories.set(cat, (categories.get(cat) || 0) + duration)
    }

    const categoryBreakdown = Array.from(categories.entries())
      .map(([cat, mins]) => `${cat}: ${Math.round(mins / 60 * 10) / 10}h`)
      .join(', ')

    return `${agenda.length} activities planned (${Math.round(totalMinutes / 60 * 10) / 10}h total). ${categoryBreakdown}`
  }
}

/**
 * Execute a workflow by slug
 */
export async function executeWorkflow(options: ExecutorOptions): Promise<ExecutorResult> {
  const executor = new WorkflowExecutor(options)
  return executor.execute()
}

/**
 * Resume a paused workflow execution
 */
export async function resumeWorkflowExecution(
  executionId: string,
  userId: string,
  feedback: string,
  action: 'approve' | 'reject' | 'iterate'
): Promise<ExecutorResult> {
  const supabase = await createClient()

  // Load execution
  const { data: execution, error } = await supabase
    .from('workflow_executions')
    .select('*')
    .eq('id', executionId)
    .eq('user_id', userId)
    .single()

  if (error || !execution) {
    throw new Error('Execution not found')
  }

  // Load workflow
  const { data: workflow } = await supabase
    .from('workflows')
    .select('*')
    .eq('id', execution.workflow_id)
    .single()

  if (!workflow) {
    throw new Error('Workflow not found')
  }

  // Create executor and resume
  const executor = new WorkflowExecutor({
    userId,
    workflowId: workflow.id,
    inputData: execution.input_data as Record<string, unknown>,
    targetDate: (execution.input_data as { target_date?: string })?.target_date,
  })

  // Manually set execution state
  ;(executor as unknown as { execution: WorkflowExecution }).execution = execution as WorkflowExecution
  ;(executor as unknown as { workflow: Workflow }).workflow = workflow as Workflow

  return executor.resume(feedback, action)
}
