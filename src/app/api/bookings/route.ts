import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { authenticateRequest, permissions } from '@/lib/auth'
import { createBookingSchema, validateBody, formatZodError } from '@/lib/validation'
import { checkBookingConflict } from '@/lib/conflicts'
import { addToWaitlist } from '@/lib/waitlist'
import { successResponse, errorResponse, errors, parseBody, parseQueryParams, getPaginationParams } from '@/lib/api-utils'

// GET /api/bookings - List bookings (staff sees all, others see own)
export async function GET(request: NextRequest) {
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  const searchParams = parseQueryParams(request)
  const { limit, offset } = getPaginationParams(searchParams)

  let query = supabase
    .from('bookings')
    .select(`
      *,
      activity:activities(*, program:programs(*)),
      participant:participants(*, user:users(first_name, last_name, email))
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  // Apply filters
  const status = searchParams.get('status')
  if (status) {
    query = query.eq('status', status)
  }

  const activityId = searchParams.get('activity_id')
  if (activityId) {
    query = query.eq('activity_id', activityId)
  }

  // Non-staff can only see their own bookings
  if (!permissions.canViewAllBookings(auth.role)) {
    // Get participant ID for current user
    const { data: participant } = await supabase
      .from('participants')
      .select('id')
      .eq('user_id', auth.userId)
      .single()

    if (participant) {
      query = query.eq('participant_id', participant.id)
    } else {
      // User is not a participant, return empty
      return successResponse({
        bookings: [],
        pagination: { total: 0, limit, offset },
      })
    }
  }

  const { data: bookings, error, count } = await query

  if (error) {
    console.error('Error fetching bookings:', error)
    return errors.internal('Failed to fetch bookings')
  }

  return successResponse({
    bookings,
    pagination: {
      total: count,
      limit,
      offset,
    },
  })
}

// POST /api/bookings - Create a new booking
export async function POST(request: NextRequest) {
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  const body = await parseBody(request)
  if (!body) {
    return errorResponse('VALIDATION_ERROR', 'Invalid JSON body', 400)
  }

  const validation = validateBody(createBookingSchema, body)
  if (!validation.success) {
    return errorResponse(
      'VALIDATION_ERROR',
      'Invalid input data',
      400,
      formatZodError(validation.error).details
    )
  }

  const { activity_id, participant_id } = validation.data

  // Verify activity exists and is valid
  const { data: activity, error: activityError } = await supabase
    .from('activities')
    .select('*')
    .eq('id', activity_id)
    .single()

  if (activityError || !activity) {
    return errors.notFound('Activity')
  }

  if (activity.is_cancelled) {
    return errorResponse('ACTIVITY_CANCELLED', 'Cannot book a cancelled activity', 400)
  }

  if (new Date(activity.start_datetime) < new Date()) {
    return errorResponse('PAST_ACTIVITY', 'Cannot book past activities', 400)
  }

  // Verify participant exists
  const { data: participant, error: participantError } = await supabase
    .from('participants')
    .select('*, user:users(*)')
    .eq('id', participant_id)
    .single()

  if (participantError || !participant) {
    return errors.notFound('Participant')
  }

  // Check if already registered
  const { data: existingBooking } = await supabase
    .from('bookings')
    .select('id, status')
    .eq('activity_id', activity_id)
    .eq('participant_id', participant_id)
    .single()

  if (existingBooking) {
    if (existingBooking.status === 'confirmed') {
      return errors.alreadyRegistered()
    }
    // If cancelled, allow re-registration
  }

  // Check for time conflicts
  const conflictResult = await checkBookingConflict(
    participant_id,
    activity.start_datetime,
    activity.end_datetime
  )

  if (conflictResult.has_conflict) {
    return errorResponse(
      'BOOKING_CONFLICT',
      `Time conflict with "${conflictResult.conflicting_activity?.title}"`,
      400,
      {
        conflicting_activity: conflictResult.conflicting_activity,
        alternatives: conflictResult.alternatives,
      }
    )
  }

  // Check capacity
  if (activity.current_bookings >= activity.capacity) {
    // Add to waitlist instead
    const waitlistResult = await addToWaitlist(activity_id, participant_id)
    
    if (!waitlistResult.success) {
      return errorResponse('WAITLIST_ERROR', waitlistResult.error || 'Failed to add to waitlist', 400)
    }

    return successResponse({
      message: 'Activity is full. Added to waitlist.',
      waitlist_position: waitlistResult.position,
      status: 'waitlisted',
    }, 201)
  }

  // Create booking
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      activity_id,
      participant_id,
      registered_by: auth.userId,
      status: 'confirmed',
    })
    .select(`
      *,
      activity:activities(*, program:programs(*)),
      participant:participants(*, user:users(first_name, last_name, email))
    `)
    .single()

  if (bookingError) {
    // Handle duplicate key error
    if (bookingError.code === '23505') {
      return errors.alreadyRegistered()
    }
    console.error('Error creating booking:', bookingError)
    return errors.internal('Failed to create booking')
  }

  // Update activity booking count
  await supabase
    .from('activities')
    .update({ current_bookings: activity.current_bookings + 1 })
    .eq('id', activity_id)

  // Log confirmation notification
  console.log(`[NOTIFICATION] Booking confirmed for ${participant.user?.first_name} ${participant.user?.last_name}`)
  console.log(`[NOTIFICATION] Activity: ${activity.title} on ${activity.start_datetime}`)

  return successResponse({
    booking,
    message: 'Booking confirmed successfully',
  }, 201)
}
