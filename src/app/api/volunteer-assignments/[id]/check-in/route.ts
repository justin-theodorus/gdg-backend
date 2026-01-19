import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { authenticateRequest } from '@/lib/auth'
import { successResponse, errorResponse, errors } from '@/lib/api-utils'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/volunteer-assignments/:id/check-in - Volunteer checks in
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  // Get assignment with activity details
  const { data: assignment, error: fetchError } = await supabase
    .from('volunteer_assignments')
    .select(`
      *,
      activity:activities(start_datetime, end_datetime, title),
      volunteer:volunteers(user_id)
    `)
    .eq('id', id)
    .single()

  if (fetchError || !assignment) {
    return errors.notFound('Assignment')
  }

  // Verify user is the assigned volunteer
  if (assignment.volunteer?.user_id !== auth.userId) {
    return errors.forbidden('Can only check in to your own assignments')
  }

  // Verify assignment is confirmed
  if (assignment.status !== 'confirmed') {
    return errorResponse('INVALID_STATUS', 'Assignment must be confirmed before check-in', 400)
  }

  // Check if already checked in
  if (assignment.check_in_time) {
    return errorResponse('ALREADY_CHECKED_IN', 'You have already checked in', 400)
  }

  // Verify timing - can check in up to 30 minutes before activity
  const activityStart = new Date(assignment.activity.start_datetime)
  const thirtyMinBefore = new Date(activityStart.getTime() - 30 * 60 * 1000)
  const now = new Date()

  if (now < thirtyMinBefore) {
    const minutesUntil = Math.ceil((thirtyMinBefore.getTime() - now.getTime()) / 60000)
    return errorResponse(
      'TOO_EARLY',
      `Check-in opens 30 minutes before the activity. Please try again in ${minutesUntil} minutes.`,
      400
    )
  }

  // Update assignment with check-in time
  const { error: updateError } = await supabase
    .from('volunteer_assignments')
    .update({
      check_in_time: now.toISOString(),
    })
    .eq('id', id)

  if (updateError) {
    console.error('Error checking in:', updateError)
    return errors.internal('Failed to check in')
  }

  return successResponse({
    message: 'Successfully checked in!',
    check_in_time: now.toISOString(),
    activity_title: assignment.activity.title,
  })
}
