import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { authenticateRequest, permissions } from '@/lib/auth'
import { successResponse, errors } from '@/lib/api-utils'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/waitlist/activity/:id - Get activity's waitlist (staff only)
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  if (!permissions.canViewAllBookings(auth.role)) {
    return errors.forbidden('Only staff can view activity waitlist')
  }

  const { data: entries, error } = await supabase
    .from('waitlist_entries')
    .select(`
      *,
      participant:participants(
        *,
        user:users(first_name, last_name, email, phone)
      )
    `)
    .eq('activity_id', id)
    .in('status', ['waiting', 'notified'])
    .order('position', { ascending: true })

  if (error) {
    console.error('Error fetching waitlist:', error)
    return errors.internal('Failed to fetch waitlist')
  }

  return successResponse({
    entries,
    total: entries?.length || 0,
  })
}
