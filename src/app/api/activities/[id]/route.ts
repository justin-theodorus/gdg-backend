import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { authenticateRequest, permissions } from '@/lib/auth'
import { updateActivitySchema, validateBody, formatZodError } from '@/lib/validation'
import { successResponse, errorResponse, errors, parseBody } from '@/lib/api-utils'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/activities/:id - Get activity details
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  const { data: activity, error } = await supabase
    .from('activities')
    .select('*, program:programs(*)')
    .eq('id', id)
    .single()

  if (error || !activity) {
    return errors.notFound('Activity')
  }

  // Get waitlist count
  const { count: waitlistCount } = await supabase
    .from('waitlist_entries')
    .select('*', { count: 'exact', head: true })
    .eq('activity_id', id)
    .in('status', ['waiting', 'notified'])

  // Get registrations if staff
  let registrations = null
  if (permissions.canViewAllBookings(auth.role)) {
    const { data } = await supabase
      .from('bookings')
      .select(`
        *,
        participant:participants(
          *,
          user:users(first_name, last_name, email, phone)
        )
      `)
      .eq('activity_id', id)
      .eq('status', 'confirmed')

    registrations = data
  }

  // Get assigned volunteers
  const { data: volunteers } = await supabase
    .from('volunteer_assignments')
    .select(`
      *,
      volunteer:volunteers(
        *,
        user:users(first_name, last_name, email, phone)
      )
    `)
    .eq('activity_id', id)
    .in('status', ['confirmed', 'invited'])

  return successResponse({
    ...activity,
    available_spots: activity.capacity - activity.current_bookings,
    waitlist_count: waitlistCount || 0,
    registrations,
    volunteers,
  })
}

// PUT /api/activities/:id - Update activity
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  if (!permissions.canModifyActivity(auth.role)) {
    return errors.forbidden('Only staff can update activities')
  }

  // Get current activity
  const { data: currentActivity, error: fetchError } = await supabase
    .from('activities')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !currentActivity) {
    return errors.notFound('Activity')
  }

  // Cannot modify cancelled activities
  if (currentActivity.is_cancelled) {
    return errorResponse('ACTIVITY_CANCELLED', 'Cannot modify cancelled activities', 400)
  }

  // Cannot modify past activities
  if (new Date(currentActivity.start_datetime) < new Date()) {
    return errorResponse('PAST_ACTIVITY', 'Cannot modify past activities', 400)
  }

  const body = await parseBody(request)
  if (!body) {
    return errorResponse('VALIDATION_ERROR', 'Invalid JSON body', 400)
  }

  const validation = validateBody(updateActivitySchema, body)
  if (!validation.success) {
    return errorResponse(
      'VALIDATION_ERROR',
      'Invalid input data',
      400,
      formatZodError(validation.error).details
    )
  }

  // Cannot reduce capacity below current bookings
  if (validation.data.capacity && validation.data.capacity < currentActivity.current_bookings) {
    return errorResponse(
      'CAPACITY_ERROR',
      `Cannot reduce capacity below current bookings (${currentActivity.current_bookings})`,
      400
    )
  }

  const { data: activity, error } = await supabase
    .from('activities')
    .update(validation.data)
    .eq('id', id)
    .select('*, program:programs(*)')
    .single()

  if (error) {
    console.error('Error updating activity:', error)
    return errors.internal('Failed to update activity')
  }

  return successResponse(activity)
}

// DELETE /api/activities/:id - Delete activity (soft delete via cancel)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  if (!permissions.canModifyActivity(auth.role)) {
    return errors.forbidden('Only staff can delete activities')
  }

  // Just mark as cancelled (use the cancel endpoint for proper flow)
  const { error } = await supabase
    .from('activities')
    .update({ is_cancelled: true, cancellation_reason: 'Deleted by staff' })
    .eq('id', id)

  if (error) {
    console.error('Error deleting activity:', error)
    return errors.internal('Failed to delete activity')
  }

  return successResponse({ message: 'Activity deleted successfully' })
}
