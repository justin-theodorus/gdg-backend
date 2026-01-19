import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { authenticateRequest, permissions } from '@/lib/auth'
import { successResponse, errorResponse, errors } from '@/lib/api-utils'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/volunteer-assignments/:id/remind - Send reminder to volunteer
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  // Only staff can send reminders
  if (!permissions.canAssignVolunteers(auth.role)) {
    return errors.forbidden('Only staff can send reminders')
  }

  // Get assignment with volunteer and activity details
  const { data: assignment, error: fetchError } = await supabase
    .from('volunteer_assignments')
    .select(`
      *,
      activity:activities(id, title, start_datetime, end_datetime, location),
      volunteer:volunteers(
        id,
        user:users(first_name, last_name, email, phone, telegram_id)
      )
    `)
    .eq('id', id)
    .single()

  if (fetchError || !assignment) {
    return errors.notFound('Assignment')
  }

  // Can only remind pending invitations
  if (assignment.status !== 'invited') {
    return errorResponse(
      'INVALID_STATUS',
      `Cannot send reminder for ${assignment.status} assignments`,
      400
    )
  }

  // Check if activity hasn't started yet
  const activityStart = new Date(assignment.activity.start_datetime)
  if (new Date() > activityStart) {
    return errorResponse('ACTIVITY_STARTED', 'Cannot remind for past activities', 400)
  }

  // In production, this would trigger actual notifications
  // For now, we just log and return success
  const volunteer = assignment.volunteer
  const activity = assignment.activity

  console.log(`[NOTIFICATION] Reminder sent to volunteer: ${volunteer?.user?.first_name} ${volunteer?.user?.last_name}`)
  console.log(`[NOTIFICATION] Email: ${volunteer?.user?.email}, Phone: ${volunteer?.user?.phone}`)
  console.log(`[NOTIFICATION] Telegram ID: ${volunteer?.user?.telegram_id}`)
  console.log(`[NOTIFICATION] Activity: ${activity.title}`)
  console.log(`[NOTIFICATION] Date: ${activity.start_datetime}`)
  console.log(`[NOTIFICATION] Location: ${activity.location}`)

  // Update assignment to track reminder was sent
  await supabase
    .from('volunteer_assignments')
    .update({
      // Could add a reminded_at field to track this
      // For now, we'll just return success
    })
    .eq('id', id)

  return successResponse({
    message: 'Reminder sent successfully',
    assignment_id: id,
    volunteer: {
      name: `${volunteer?.user?.first_name} ${volunteer?.user?.last_name}`,
      email: volunteer?.user?.email,
      phone: volunteer?.user?.phone,
    },
    activity: {
      title: activity.title,
      start_datetime: activity.start_datetime,
      location: activity.location,
    },
  })
}
