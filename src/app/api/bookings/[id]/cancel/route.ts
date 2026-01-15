import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { authenticateRequest, permissions } from '@/lib/auth'
import { processWaitlist } from '@/lib/waitlist'
import { successResponse, errorResponse, errors } from '@/lib/api-utils'

interface RouteParams {
  params: Promise<{ id: string }>
}

// PUT /api/bookings/:id/cancel - Cancel a booking
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  // Get booking with activity details
  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select(`
      *,
      activity:activities(*),
      participant:participants(user_id)
    `)
    .eq('id', id)
    .single()

  if (fetchError || !booking) {
    return errors.notFound('Booking')
  }

  // Check if already cancelled
  if (booking.status === 'cancelled') {
    return errorResponse('ALREADY_CANCELLED', 'Booking is already cancelled', 400)
  }

  // Check permissions (own booking or staff)
  const isOwner = booking.participant?.user_id === auth.userId
  const isStaff = permissions.canViewAllBookings(auth.role)

  if (!isOwner && !isStaff) {
    return errors.forbidden('Cannot cancel this booking')
  }

  // Check 2-hour rule (non-staff cannot cancel within 2 hours of activity)
  const activity = booking.activity
  const twoHoursFromNow = new Date()
  twoHoursFromNow.setHours(twoHoursFromNow.getHours() + 2)

  if (!isStaff && new Date(activity.start_datetime) <= twoHoursFromNow) {
    return errorResponse(
      'CANCELLATION_DEADLINE',
      'Cannot cancel within 2 hours of activity start. Please contact staff.',
      400
    )
  }

  // Cancel the booking
  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updateError) {
    console.error('Error cancelling booking:', updateError)
    return errors.internal('Failed to cancel booking')
  }

  // Decrement activity booking count
  await supabase
    .from('activities')
    .update({ current_bookings: Math.max(0, activity.current_bookings - 1) })
    .eq('id', activity.id)

  // Process waitlist - offer spot to next person
  const waitlistResult = await processWaitlist(activity.id)

  // Log notification
  console.log(`[NOTIFICATION] Booking cancelled for booking ${id}`)
  if (waitlistResult.notified) {
    console.log(`[NOTIFICATION] Waitlist spot offered to participant ${waitlistResult.participantId}`)
  }

  return successResponse({
    message: 'Booking cancelled successfully',
    waitlist_notified: waitlistResult.notified,
  })
}
