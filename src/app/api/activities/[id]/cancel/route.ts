import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { authenticateRequest, permissions } from '@/lib/auth'
import { successResponse, errorResponse, errors, parseBody } from '@/lib/api-utils'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ id: string }>
}

const cancelSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required'),
})

// POST /api/activities/:id/cancel - Cancel an activity
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  if (!permissions.canModifyActivity(auth.role)) {
    return errors.forbidden('Only staff can cancel activities')
  }

  const body = await parseBody(request)
  const validation = cancelSchema.safeParse(body)
  if (!validation.success) {
    return errorResponse('VALIDATION_ERROR', 'Cancellation reason is required', 400)
  }

  // Get activity
  const { data: activity, error: fetchError } = await supabase
    .from('activities')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !activity) {
    return errors.notFound('Activity')
  }

  if (activity.is_cancelled) {
    return errorResponse('ALREADY_CANCELLED', 'Activity is already cancelled', 400)
  }

  // Cancel the activity
  const { error: updateError } = await supabase
    .from('activities')
    .update({
      is_cancelled: true,
      cancellation_reason: validation.data.reason,
    })
    .eq('id', id)

  if (updateError) {
    console.error('Error cancelling activity:', updateError)
    return errors.internal('Failed to cancel activity')
  }

  // Cancel all confirmed bookings
  const { data: cancelledBookings } = await supabase
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    })
    .eq('activity_id', id)
    .eq('status', 'confirmed')
    .select('participant_id')

  // Cancel all waitlist entries
  await supabase
    .from('waitlist_entries')
    .update({ status: 'cancelled' })
    .eq('activity_id', id)
    .in('status', ['waiting', 'notified'])

  // Cancel volunteer assignments
  await supabase
    .from('volunteer_assignments')
    .update({ status: 'cancelled' })
    .eq('activity_id', id)
    .in('status', ['invited', 'confirmed'])

  return successResponse({
    message: 'Activity cancelled successfully',
    cancelled_bookings: cancelledBookings?.length || 0,
    reason: validation.data.reason,
  })
}
