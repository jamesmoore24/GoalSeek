import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth-helpers'

/**
 * GET /api/workflows
 * List all workflows for the user
 */
export async function GET() {
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('name')

    if (error) {
      console.error('GET /api/workflows error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ workflows: data })
  } catch (error) {
    console.error('GET /api/workflows error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/workflows
 * Create a new workflow
 */
export async function POST(request: Request) {
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  try {
    const body = await request.json()
    const { name, slug, description, steps, enabled_integrations, autonomous_schedule } = body

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('workflows')
      .insert({
        user_id: user.id,
        name,
        slug,
        description,
        steps: steps || [],
        enabled_integrations: enabled_integrations || [],
        autonomous_schedule,
        is_system: false,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A workflow with this slug already exists' },
          { status: 409 }
        )
      }
      console.error('POST /api/workflows error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ workflow: data }, { status: 201 })
  } catch (error) {
    console.error('POST /api/workflows error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
