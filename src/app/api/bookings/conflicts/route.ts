import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { authenticateRequest } from '@/lib/auth'
import { checkBookingConflict } from '@/lib/conflicts'
import { successResponse, errorResponse, errors, parseBody } from '@/lib/api-utils'
import { z } from 'zod'

const conflictCheckSchema = z.object({
  participant_id: z.string().uuid(),
  activity_id: z.string().uuid(),
})

// POST /api/bookings/conflicts - Check for conflicts without creating booking
export async function POST(request: NextRequest) {
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  const body = await parseBody(request)
  const validation = conflictCheckSchema.safeParse(body)

  if (!validation.success) {
    return errorResponse('VALIDATION_ERROR', 'Invalid input', 400)
  }

  const { participant_id, activity_id } = validation.data

  // Get activity details
  const { data: activity, error } = await supabase
    .from('activities')
    .select('start_datetime, end_datetime, capacity, current_bookings')
    .eq('id', activity_id)
    .single()

  if (error || !activity) {
    return errors.notFound('Activity')
  }

  // Check for conflicts
  const conflictResult = await checkBookingConflict(
    participant_id,
    activity.start_datetime,
    activity.end_datetime
  )

  // Check availability
  const availableSpots = activity.capacity - activity.current_bookings

  return successResponse({
    has_conflict: conflictResult.has_conflict,
    conflicting_activity: conflictResult.conflicting_activity,
    alternatives: conflictResult.alternatives,
    available_spots: availableSpots,
    would_waitlist: availableSpots <= 0,
  })
}
