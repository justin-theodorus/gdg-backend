import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { authenticateRequest } from '@/lib/auth'
import { updateParticipantSchema, validateBody, formatZodError } from '@/lib/validation'
import { successResponse, errorResponse, errors, parseBody } from '@/lib/api-utils'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/participants/:id - Get participant details
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  const { data: participant, error } = await supabase
    .from('participants')
    .select('*, user:users(first_name, last_name, email, phone)')
    .eq('id', id)
    .single()

  if (error || !participant) {
    return errors.notFound('Participant')
  }

  // Get upcoming bookings
  const { data: upcomingBookings } = await supabase
    .from('bookings')
    .select(`
      *,
      activity:activities(title, start_datetime, end_datetime, location)
    `)
    .eq('participant_id', id)
    .eq('status', 'confirmed')
    .gte('activity.start_datetime', new Date().toISOString())
    .order('activity(start_datetime)', { ascending: true })
    .limit(10)

  // Get booking history count
  const { count: totalBookings } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('participant_id', id)

  const { count: attendedBookings } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('participant_id', id)
    .eq('attended', true)

  return successResponse({
    ...participant,
    upcoming_bookings: upcomingBookings,
    stats: {
      total_bookings: totalBookings || 0,
      attended: attendedBookings || 0,
      attendance_rate: totalBookings ? ((attendedBookings || 0) / totalBookings * 100).toFixed(1) : 0,
    },
  })
}

// PUT /api/participants/:id - Update participant profile
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  const body = await parseBody(request)
  if (!body) {
    return errorResponse('VALIDATION_ERROR', 'Invalid JSON body', 400)
  }

  const validation = validateBody(updateParticipantSchema, body)
  if (!validation.success) {
    return errorResponse(
      'VALIDATION_ERROR',
      'Invalid input data',
      400,
      formatZodError(validation.error).details
    )
  }

  const { data: participant, error } = await supabase
    .from('participants')
    .update(validation.data)
    .eq('id', id)
    .select('*, user:users(first_name, last_name, email)')
    .single()

  if (error) {
    console.error('Error updating participant:', error)
    return errors.notFound('Participant')
  }

  return successResponse(participant)
}
