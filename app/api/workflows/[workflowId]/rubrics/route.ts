import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth-helpers'
import { createDefaultPlanmydayRubrics } from '@/lib/workflows'

/**
 * GET /api/workflows/[workflowId]/rubrics
 * List rubrics for a workflow
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  try {
    const { workflowId } = await params
    const supabase = await createClient()

    // Verify workflow belongs to user
    const { data: workflow, error: workflowError } = await supabase
      .from('workflows')
      .select('id, slug')
      .eq('id', workflowId)
      .eq('user_id', user.id)
      .single()

    if (workflowError || !workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    // Get rubrics
    const { data: rubrics, error } = await supabase
      .from('workflow_rubrics')
      .select('*')
      .eq('workflow_id', workflowId)
      .eq('user_id', user.id)
      .order('category')
      .order('name')

    if (error) {
      console.error('GET /api/workflows/[id]/rubrics error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // If no rubrics and this is planmyday, create defaults
    if (rubrics.length === 0 && workflow.slug === 'planmyday') {
      const defaultRubrics = await createDefaultPlanmydayRubrics(workflowId, user.id)
      return NextResponse.json({ rubrics: defaultRubrics })
    }

    return NextResponse.json({ rubrics })
  } catch (error) {
    console.error('GET /api/workflows/[id]/rubrics error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/workflows/[workflowId]/rubrics
 * Create a new rubric
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  try {
    const { workflowId } = await params
    const body = await request.json()
    const {
      category,
      name,
      description,
      constraint_type = 'soft',
      validation_rule,
      weight = 5,
    } = body

    if (!category || !name || !validation_rule) {
      return NextResponse.json(
        { error: 'Category, name, and validation_rule are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Verify workflow belongs to user
    const { data: workflow, error: workflowError } = await supabase
      .from('workflows')
      .select('id')
      .eq('id', workflowId)
      .eq('user_id', user.id)
      .single()

    if (workflowError || !workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    // Create rubric
    const { data, error } = await supabase
      .from('workflow_rubrics')
      .insert({
        workflow_id: workflowId,
        user_id: user.id,
        category,
        name,
        description,
        constraint_type,
        validation_rule,
        weight,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      console.error('POST /api/workflows/[id]/rubrics error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ rubric: data }, { status: 201 })
  } catch (error) {
    console.error('POST /api/workflows/[id]/rubrics error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
