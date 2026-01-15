import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { authenticateRequest } from '@/lib/auth'
import { updateVolunteerSchema, validateBody, formatZodError } from '@/lib/validation'
import { successResponse, errorResponse, errors, parseBody } from '@/lib/api-utils'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/volunteers/:id - Get volunteer details
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  const { data: volunteer, error } = await supabase
    .from('volunteers')
    .select('*, user:users(first_name, last_name, email, phone)')
    .eq('id', id)
    .single()

  if (error || !volunteer) {
    return errors.notFound('Volunteer')
  }

  // Get recent assignments
  const { data: assignments } = await supabase
    .from('volunteer_assignments')
    .select(`
      *,
      activity:activities(title, start_datetime, location)
    `)
    .eq('volunteer_id', id)
    .order('created_at', { ascending: false })
    .limit(10)

  return successResponse({
    ...volunteer,
    recent_assignments: assignments,
  })
}

// PUT /api/volunteers/:id - Update volunteer profile
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  const body = await parseBody(request)
  if (!body) {
    return errorResponse('VALIDATION_ERROR', 'Invalid JSON body', 400)
  }

  const validation = validateBody(updateVolunteerSchema, body)
  if (!validation.success) {
    return errorResponse(
      'VALIDATION_ERROR',
      'Invalid input data',
      400,
      formatZodError(validation.error).details
    )
  }

  const { data: volunteer, error } = await supabase
    .from('volunteers')
    .update(validation.data)
    .eq('id', id)
    .select('*, user:users(first_name, last_name, email)')
    .single()

  if (error) {
    console.error('Error updating volunteer:', error)
    return errors.notFound('Volunteer')
  }

  return successResponse(volunteer)
}
