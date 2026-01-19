import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { authenticateRequest, permissions } from '@/lib/auth'
import { successResponse, errorResponse, errors, parseBody } from '@/lib/api-utils'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ id: string }>
}

const completeAssignmentSchema = z.object({
  staff_rating: z.number().int().min(1).max(5),
  volunteer_feedback: z.string().optional(),
  hours_contributed: z.number().positive().optional(),
})

// POST /api/volunteer-assignments/:id/complete - Complete and rate a volunteer assignment
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  // Only staff can complete/rate assignments
  if (!permissions.canAssignVolunteers(auth.role)) {
    return errors.forbidden('Only staff can complete volunteer assignments')
  }

  // Get assignment with activity and volunteer details
  const { data: assignment, error: fetchError } = await supabase
    .from('volunteer_assignments')
    .select(`
      *,
      activity:activities(id, title, start_datetime, end_datetime),
      volunteer:volunteers(id, user_id, rating, total_hours, total_sessions)
    `)
    .eq('id', id)
    .single()

  if (fetchError || !assignment) {
    return errors.notFound('Assignment')
  }

  // Verify assignment can be completed
  if (assignment.status === 'completed') {
    return errorResponse('ALREADY_COMPLETED', 'Assignment has already been completed', 400)
  }

  if (assignment.status !== 'confirmed') {
    return errorResponse('INVALID_STATUS', 'Only confirmed assignments can be completed', 400)
  }

  // Verify activity has ended
  const activityEnd = new Date(assignment.activity.end_datetime)
  if (new Date() < activityEnd) {
    return errorResponse('ACTIVITY_NOT_ENDED', 'Cannot complete assignment before activity ends', 400)
  }

  // Parse and validate body
  const body = await parseBody(request)
  const validation = completeAssignmentSchema.safeParse(body)

  if (!validation.success) {
    return errorResponse('VALIDATION_ERROR', 'Invalid input data', 400, validation.error.format())
  }

  const { staff_rating, volunteer_feedback, hours_contributed } = validation.data

  // Calculate hours if not provided (from check-in/out times or activity duration)
  let finalHours = hours_contributed
  if (!finalHours) {
    if (assignment.check_in_time && assignment.check_out_time) {
      const checkIn = new Date(assignment.check_in_time)
      const checkOut = new Date(assignment.check_out_time)
      finalHours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60) // hours
    } else {
      // Default to activity duration
      const start = new Date(assignment.activity.start_datetime)
      const end = new Date(assignment.activity.end_datetime)
      finalHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
    }
  }

  // Round hours to 1 decimal place
  finalHours = Math.round(finalHours * 10) / 10

  // Update assignment
  const { error: updateError } = await supabase
    .from('volunteer_assignments')
    .update({
      status: 'completed',
      staff_rating,
      volunteer_feedback,
      hours_contributed: finalHours,
    })
    .eq('id', id)

  if (updateError) {
    console.error('Error completing assignment:', updateError)
    return errors.internal('Failed to complete assignment')
  }

  // Update volunteer stats
  const volunteer = assignment.volunteer
  const newTotalSessions = (volunteer.total_sessions || 0) + 1
  const newTotalHours = parseFloat(volunteer.total_hours || 0) + finalHours
  
  // Calculate new average rating
  const oldRating = parseFloat(volunteer.rating || 0)
  const oldSessions = volunteer.total_sessions || 0
  let newRating = staff_rating
  if (oldSessions > 0) {
    // Weighted average: ((old_rating * old_sessions) + new_rating) / new_sessions
    newRating = ((oldRating * oldSessions) + staff_rating) / newTotalSessions
  }
  newRating = Math.round(newRating * 10) / 10 // Round to 1 decimal

  const { error: volunteerError } = await supabase
    .from('volunteers')
    .update({
      rating: newRating,
      total_hours: newTotalHours,
      total_sessions: newTotalSessions,
      updated_at: new Date().toISOString(),
    })
    .eq('id', volunteer.id)

  if (volunteerError) {
    console.error('Error updating volunteer stats:', volunteerError)
    // Don't fail the request, just log it
  }

  // Log notification (in production, this would send actual notification)
  console.log(`[NOTIFICATION] Volunteer assignment completed`)
  console.log(`[NOTIFICATION] Activity: ${assignment.activity.title}`)
  console.log(`[NOTIFICATION] Rating: ${staff_rating}/5, Hours: ${finalHours}`)

  return successResponse({
    message: 'Assignment completed successfully',
    assignment_id: id,
    hours_contributed: finalHours,
    staff_rating,
    volunteer_new_stats: {
      rating: newRating,
      total_hours: newTotalHours,
      total_sessions: newTotalSessions,
    },
  })
}
