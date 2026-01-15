import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { authenticateRequest } from '@/lib/auth'
import { respondAssignmentSchema, validateBody, formatZodError } from '@/lib/validation'
import { successResponse, errorResponse, errors, parseBody } from '@/lib/api-utils'

interface RouteParams {
  params: Promise<{ id: string }>
}

// PUT /api/volunteer-assignments/:id/respond - Accept or decline assignment
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

  const validation = validateBody(respondAssignmentSchema, body)
  if (!validation.success) {
    return errorResponse(
      'VALIDATION_ERROR',
      'Invalid input data',
      400,
      formatZodError(validation.error).details
    )
  }

  const { response } = validation.data

  // Get assignment
  const { data: assignment, error: fetchError } = await supabase
    .from('volunteer_assignments')
    .select(`
      *,
      activity:activities(*),
      volunteer:volunteers(user_id)
    `)
    .eq('id', id)
    .single()

  if (fetchError || !assignment) {
    return errors.notFound('Assignment')
  }

  // Only the assigned volunteer can respond
  if (assignment.volunteer?.user_id !== auth.userId) {
    return errors.forbidden('Can only respond to your own assignments')
  }

  // Check if assignment is still pending
  if (assignment.status !== 'invited') {
    return errorResponse('ALREADY_RESPONDED', 'Assignment has already been responded to', 400)
  }

  // Update assignment
  const newStatus = response === 'accepted' ? 'confirmed' : 'declined'
  
  const { error: updateError } = await supabase
    .from('volunteer_assignments')
    .update({
      status: newStatus,
      responded_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updateError) {
    console.error('Error updating assignment:', updateError)
    return errors.internal('Failed to update assignment')
  }

  // If declined, decrement volunteer count
  if (response === 'declined') {
    const activity = assignment.activity
    await supabase
      .from('activities')
      .update({ current_volunteers: Math.max(0, activity.current_volunteers - 1) })
      .eq('id', activity.id)

    console.log(`[NOTIFICATION] Volunteer declined assignment for ${activity.title}`)
  } else {
    console.log(`[NOTIFICATION] Volunteer confirmed for ${assignment.activity?.title}`)
  }

  return successResponse({
    message: response === 'accepted' ? 'Assignment confirmed!' : 'Assignment declined',
    status: newStatus,
  })
}
