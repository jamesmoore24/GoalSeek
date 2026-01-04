import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { executeWorkflow } from '@/lib/workflows'

/**
 * POST /api/workflows/execute
 * Execute a workflow (e.g., /planmyday)
 */
export async function POST(request: Request) {
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  try {
    const body = await request.json()
    const { workflow_id, workflow_slug, target_date, input_data } = body

    if (!workflow_id && !workflow_slug) {
      return NextResponse.json(
        { error: 'Either workflow_id or workflow_slug is required' },
        { status: 400 }
      )
    }

    // Execute the workflow
    const result = await executeWorkflow({
      userId: user.id,
      workflowId: workflow_id,
      workflowSlug: workflow_slug,
      targetDate: target_date || new Date().toISOString().split('T')[0],
      inputData: input_data,
    })

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
    console.error('POST /api/workflows/execute error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
