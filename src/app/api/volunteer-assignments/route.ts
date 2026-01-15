import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { authenticateRequest, permissions } from '@/lib/auth'
import { createAssignmentSchema, validateBody, formatZodError } from '@/lib/validation'
import { successResponse, errorResponse, errors, parseBody } from '@/lib/api-utils'

// POST /api/volunteer-assignments - Create a volunteer assignment
export async function POST(request: NextRequest) {
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  if (!permissions.canAssignVolunteers(auth.role)) {
    return errors.forbidden('Only staff can assign volunteers')
  }

  const body = await parseBody(request)
  if (!body) {
    return errorResponse('VALIDATION_ERROR', 'Invalid JSON body', 400)
  }

  const validation = validateBody(createAssignmentSchema, body)
  if (!validation.success) {
    return errorResponse(
      'VALIDATION_ERROR',
      'Invalid input data',
      400,
      formatZodError(validation.error).details
    )
  }

  const { activity_id, volunteer_id, role, responsibilities } = validation.data

  // Verify activity exists and needs volunteers
  const { data: activity, error: activityError } = await supabase
    .from('activities')
    .select('*')
    .eq('id', activity_id)
    .single()

  if (activityError || !activity) {
    return errors.notFound('Activity')
  }

  if (activity.is_cancelled) {
    return errorResponse('ACTIVITY_CANCELLED', 'Cannot assign to cancelled activity', 400)
  }

  if (activity.current_volunteers >= activity.max_volunteers) {
    return errorResponse('VOLUNTEERS_FULL', 'Activity has reached maximum volunteers', 400)
  }

  // Verify volunteer exists
  const { data: volunteer, error: volunteerError } = await supabase
    .from('volunteers')
    .select('*, user:users(first_name, last_name, email)')
    .eq('id', volunteer_id)
    .single()

  if (volunteerError || !volunteer) {
    return errors.notFound('Volunteer')
  }

  // Check for existing assignment
  const { data: existingAssignment } = await supabase
    .from('volunteer_assignments')
    .select('id, status')
    .eq('activity_id', activity_id)
    .eq('volunteer_id', volunteer_id)
    .single()

  if (existingAssignment && existingAssignment.status !== 'declined' && existingAssignment.status !== 'cancelled') {
    return errors.conflict('Volunteer already assigned to this activity')
  }

  // Create assignment
  const { data: assignment, error: assignmentError } = await supabase
    .from('volunteer_assignments')
    .insert({
      activity_id,
      volunteer_id,
      role: role || 'assistant',
      responsibilities,
      status: 'invited',
    })
    .select(`
      *,
      activity:activities(title, start_datetime, location),
      volunteer:volunteers(*, user:users(first_name, last_name, email))
    `)
    .single()

  if (assignmentError) {
    console.error('Error creating assignment:', assignmentError)
    return errors.internal('Failed to create assignment')
  }

  // Update activity volunteer count
  await supabase
    .from('activities')
    .update({ current_volunteers: activity.current_volunteers + 1 })
    .eq('id', activity_id)

  // Log notification
  console.log(`[NOTIFICATION] Volunteer invitation sent to ${volunteer.user?.first_name} ${volunteer.user?.last_name}`)
  console.log(`[NOTIFICATION] Activity: ${activity.title}, Role: ${role || 'assistant'}`)

  return successResponse(assignment, 201)
}
