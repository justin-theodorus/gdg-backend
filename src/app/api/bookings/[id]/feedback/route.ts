import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { authenticateRequest } from '@/lib/auth'
import { successResponse, errorResponse, errors, parseBody } from '@/lib/api-utils'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ id: string }>
}

const feedbackSchema = z.object({
  rating: z.number().min(1).max(5),
  feedback_text: z.string().max(500).optional(),
})

// POST /api/bookings/:id/feedback - Submit feedback for completed activity
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  const body = await parseBody(request)
  if (!body) {
    return errorResponse('VALIDATION_ERROR', 'Invalid JSON body', 400)
  }

  const validation = feedbackSchema.safeParse(body)
  if (!validation.success) {
    return errorResponse('VALIDATION_ERROR', 'Rating must be between 1-5', 400)
  }

  const { rating, feedback_text } = validation.data

  // Get booking and verify ownership
  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select(`
      *,
      participant:participants(user_id),
      activity:activities(start_datetime, end_datetime)
    `)
    .eq('id', id)
    .single()

  if (fetchError || !booking) {
    return errors.notFound('Booking')
  }

  // Verify user owns this booking
  if (booking.participant?.user_id !== auth.userId) {
    return errors.forbidden('Can only rate your own bookings')
  }

  // Verify activity has ended
  if (new Date(booking.activity.end_datetime) > new Date()) {
    return errorResponse('ACTIVITY_NOT_COMPLETED', 'Cannot rate an activity that has not ended', 400)
  }

  // Check if already rated
  if (booking.feedback_rating) {
    return errorResponse('ALREADY_RATED', 'You have already rated this activity', 400)
  }

  // Update booking with feedback
  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      feedback_rating: rating,
      feedback_text: feedback_text || null,
      status: 'completed',
      attended: true,
    })
    .eq('id', id)

  if (updateError) {
    console.error('Error submitting feedback:', updateError)
    return errors.internal('Failed to submit feedback')
  }

  return successResponse({
    message: 'Thank you for your feedback!',
    rating,
  })
}
