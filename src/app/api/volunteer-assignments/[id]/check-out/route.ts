import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { authenticateRequest } from '@/lib/auth'
import { successResponse, errorResponse, errors, parseBody } from '@/lib/api-utils'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ id: string }>
}

const checkOutSchema = z.object({
  volunteer_feedback: z.string().max(500).optional(),
  self_rating: z.number().min(1).max(5).optional(),
})

// POST /api/volunteer-assignments/:id/check-out - Volunteer checks out
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  const body = await parseBody(request)
  const validation = checkOutSchema.safeParse(body || {})
  
  const { volunteer_feedback } = validation.success ? validation.data : { volunteer_feedback: undefined }

  // Get assignment with details
  const { data: assignment, error: fetchError } = await supabase
    .from('volunteer_assignments')
    .select(`
      *,
      activity:activities(start_datetime, end_datetime, title),
      volunteer:volunteers(id, user_id, total_hours, total_sessions)
    `)
    .eq('id', id)
    .single()

  if (fetchError || !assignment) {
    return errors.notFound('Assignment')
  }

  // Verify user is the assigned volunteer
  if (assignment.volunteer?.user_id !== auth.userId) {
    return errors.forbidden('Can only check out of your own assignments')
  }

  // Verify checked in first
  if (!assignment.check_in_time) {
    return errorResponse('NOT_CHECKED_IN', 'You must check in before checking out', 400)
  }

  // Check if already checked out
  if (assignment.check_out_time) {
    return errorResponse('ALREADY_CHECKED_OUT', 'You have already checked out', 400)
  }

  const now = new Date()
  const checkInTime = new Date(assignment.check_in_time)
  
  // Calculate hours contributed (in decimal hours)
  const hoursContributed = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)
  const roundedHours = Math.round(hoursContributed * 100) / 100 // Round to 2 decimal places

  // Update assignment
  const { error: updateError } = await supabase
    .from('volunteer_assignments')
    .update({
      check_out_time: now.toISOString(),
      hours_contributed: roundedHours,
      volunteer_feedback: volunteer_feedback || null,
      status: 'completed',
    })
    .eq('id', id)

  if (updateError) {
    console.error('Error checking out:', updateError)
    return errors.internal('Failed to check out')
  }

  // Update volunteer's total hours and sessions
  const newTotalHours = (assignment.volunteer.total_hours || 0) + roundedHours
  const newTotalSessions = (assignment.volunteer.total_sessions || 0) + 1

  await supabase
    .from('volunteers')
    .update({
      total_hours: newTotalHours,
      total_sessions: newTotalSessions,
      updated_at: now.toISOString(),
    })
    .eq('id', assignment.volunteer.id)

  return successResponse({
    message: 'Successfully checked out!',
    check_out_time: now.toISOString(),
    hours_contributed: roundedHours,
    total_hours: newTotalHours,
    total_sessions: newTotalSessions,
  })
}
