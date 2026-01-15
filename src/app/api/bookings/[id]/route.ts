import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { authenticateRequest } from '@/lib/auth'
import { successResponse, errors } from '@/lib/api-utils'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/bookings/:id - Get booking details
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  const { data: booking, error } = await supabase
    .from('bookings')
    .select(`
      *,
      activity:activities(*, program:programs(*)),
      participant:participants(*, user:users(first_name, last_name, email, phone))
    `)
    .eq('id', id)
    .single()

  if (error || !booking) {
    return errors.notFound('Booking')
  }

  return successResponse(booking)
}
