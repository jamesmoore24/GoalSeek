import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth-helpers'
import { resumeWorkflowExecution } from '@/lib/workflows'

/**
 * GET /api/workflows/executions/[executionId]
 * Get execution status and details
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ executionId: string }> }
) {
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  try {
    const { executionId } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('workflow_executions')
      .select(`
        *,
        workflow:workflows(id, name, slug, description)
      `)
      .eq('id', executionId)
      .eq('user_id', user.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Execution not found' }, { status: 404 })
      }
      console.error('GET /api/workflows/executions/[id] error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ execution: data })
  } catch (error) {
    console.error('GET /api/workflows/executions/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/workflows/executions/[executionId]
 * Submit feedback and continue/approve/reject execution
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ executionId: string }> }
) {
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  try {
    const { executionId } = await params
    const body = await request.json()
    const { feedback, action } = body

    if (!action || !['approve', 'reject', 'iterate'].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be one of: approve, reject, iterate' },
        { status: 400 }
      )
    }

    // Resume the workflow with feedback
    const result = await resumeWorkflowExecution(
      executionId,
      user.id,
      feedback || '',
      action
    )

    if (result.error) {
      return NextResponse.json(
        {
          execution: result.execution,
          error: result.error,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      execution: result.execution,
      proposal: result.proposal,
    })
  } catch (error) {
    console.error('POST /api/workflows/executions/[id] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/workflows/executions/[executionId]
 * Cancel an execution
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ executionId: string }> }
) {
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  try {
    const { executionId } = await params
    const supabase = await createClient()

    const { error } = await supabase
      .from('workflow_executions')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
      })
      .eq('id', executionId)
      .eq('user_id', user.id)
      .eq('status', 'awaiting_user') // Can only cancel pending executions

    if (error) {
      console.error('DELETE /api/workflows/executions/[id] error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/workflows/executions/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
