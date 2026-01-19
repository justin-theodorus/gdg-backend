import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { authenticateRequest, permissions } from '@/lib/auth'
import { successResponse, errorResponse, errors, parseBody } from '@/lib/api-utils'

interface RouteParams {
  params: Promise<{ id: string }>
}

// PUT /api/bookings/:id/check-in - Check in a participant for an activity
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  // Only staff can check in participants
  if (!permissions.canViewAllBookings(auth.role)) {
    return errors.forbidden('Only staff can check in participants')
  }

  // Get booking with activity details
  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select(`
      *,
      activity:activities(id, title, start_datetime, end_datetime),
      participant:participants(*, user:users(first_name, last_name))
    `)
    .eq('id', id)
    .single()

  if (fetchError || !booking) {
    return errors.notFound('Booking')
  }

  // Verify booking status
  if (booking.status !== 'confirmed') {
    return errorResponse('INVALID_STATUS', `Cannot check in a ${booking.status} booking`, 400)
  }

  // Parse body for check_in action (true = check in, false = undo)
  const body = await parseBody(request) as { check_in?: boolean } | null
  const checkIn = body?.check_in !== false // Default to true

  // Verify timing - activity should be today (or recently started)
  const activityStart = new Date(booking.activity.start_datetime)
  const activityEnd = new Date(booking.activity.end_datetime)
  const now = new Date()

  // Allow check-in from 30 minutes before to 2 hours after activity start
  const earliestCheckIn = new Date(activityStart.getTime() - 30 * 60 * 1000)
  const latestCheckIn = new Date(activityStart.getTime() + 2 * 60 * 60 * 1000)

  if (checkIn && (now < earliestCheckIn || now > latestCheckIn)) {
    const isEarly = now < earliestCheckIn
    return errorResponse(
      isEarly ? 'TOO_EARLY' : 'TOO_LATE',
      isEarly 
        ? 'Check-in opens 30 minutes before the activity starts'
        : 'Check-in window has closed (2 hours after start)',
      400
    )
  }

  if (checkIn) {
    // Check in
    if (booking.checked_in_at) {
      return errorResponse('ALREADY_CHECKED_IN', 'Participant is already checked in', 400)
    }

    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        checked_in_at: now.toISOString(),
        attended: true,
      })
      .eq('id', id)

    if (updateError) {
      console.error('Error checking in:', updateError)
      return errors.internal('Failed to check in participant')
    }

    return successResponse({
      message: 'Participant checked in successfully',
      booking_id: id,
      checked_in_at: now.toISOString(),
      participant: {
        name: `${booking.participant?.user?.first_name} ${booking.participant?.user?.last_name}`,
      },
      activity: {
        title: booking.activity.title,
      },
    })
  } else {
    // Undo check-in
    if (!booking.checked_in_at) {
      return errorResponse('NOT_CHECKED_IN', 'Participant is not checked in', 400)
    }

    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        checked_in_at: null,
        attended: null,
      })
      .eq('id', id)

    if (updateError) {
      console.error('Error undoing check-in:', updateError)
      return errors.internal('Failed to undo check-in')
    }

    return successResponse({
      message: 'Check-in undone successfully',
      booking_id: id,
      participant: {
        name: `${booking.participant?.user?.first_name} ${booking.participant?.user?.last_name}`,
      },
    })
  }
}

// POST /api/bookings/:id/check-in - Bulk check-in (alternative endpoint)
export async function POST(request: NextRequest, { params }: RouteParams) {
  // Redirect to PUT for single check-in
  return PUT(request, { params })
}
