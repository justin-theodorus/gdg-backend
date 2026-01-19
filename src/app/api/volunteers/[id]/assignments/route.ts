import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { authenticateRequest } from '@/lib/auth'
import { successResponse, errors, parseQueryParams } from '@/lib/api-utils'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/volunteers/:id/assignments - Get volunteer's assignments
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  const searchParams = parseQueryParams(request)
  const status = searchParams.get('status') // invited, confirmed, completed, declined

  // Verify volunteer exists
  const { data: volunteer, error: volunteerError } = await supabase
    .from('volunteers')
    .select('user_id')
    .eq('id', id)
    .single()

  if (volunteerError || !volunteer) {
    return errors.notFound('Volunteer')
  }

  // Check if user is the volunteer or staff
  if (volunteer.user_id !== auth.userId && auth.role !== 'staff') {
    return errors.forbidden('Can only view your own assignments')
  }

  // Build query
  let query = supabase
    .from('volunteer_assignments')
    .select(`
      *,
      activity:activities(
        id, title, description, start_datetime, end_datetime, 
        location, room, activity_type, 
        program:programs(name, color)
      )
    `)
    .eq('volunteer_id', id)
    .order('created_at', { ascending: false })

  // Filter by status if provided
  if (status) {
    query = query.eq('status', status)
  }

  const { data: assignments, error } = await query

  if (error) {
    console.error('Error fetching assignments:', error)
    return errors.internal('Failed to fetch assignments')
  }

  // Group assignments by status
  const grouped = {
    invited: assignments?.filter(a => a.status === 'invited') || [],
    confirmed: assignments?.filter(a => a.status === 'confirmed') || [],
    completed: assignments?.filter(a => a.status === 'completed') || [],
    declined: assignments?.filter(a => a.status === 'declined') || [],
    cancelled: assignments?.filter(a => a.status === 'cancelled') || [],
  }

  return successResponse({
    assignments,
    grouped,
    total: assignments?.length || 0,
  })
}
