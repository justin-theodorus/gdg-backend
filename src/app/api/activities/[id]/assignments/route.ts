import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { authenticateRequest, permissions } from '@/lib/auth'
import { successResponse, errors, parseQueryParams } from '@/lib/api-utils'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/activities/:id/assignments - Get all volunteer assignments for an activity
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  // Only staff can view all assignments
  if (!permissions.canViewAllBookings(auth.role)) {
    return errors.forbidden('Only staff can view volunteer assignments')
  }

  // Verify activity exists
  const { data: activity, error: activityError } = await supabase
    .from('activities')
    .select('id, title, start_datetime, end_datetime, min_volunteers, max_volunteers, current_volunteers')
    .eq('id', id)
    .single()

  if (activityError || !activity) {
    return errors.notFound('Activity')
  }

  // Get all assignments for this activity
  const { data: assignments, error: assignmentsError } = await supabase
    .from('volunteer_assignments')
    .select(`
      *,
      volunteer:volunteers(
        id,
        rating,
        total_hours,
        total_sessions,
        interests,
        skills,
        user:users(first_name, last_name, email, phone)
      )
    `)
    .eq('activity_id', id)
    .order('created_at', { ascending: true })

  if (assignmentsError) {
    console.error('Error fetching assignments:', assignmentsError)
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

  // Calculate stats
  const stats = {
    total: assignments?.length || 0,
    invited: grouped.invited.length,
    confirmed: grouped.confirmed.length,
    completed: grouped.completed.length,
    declined: grouped.declined.length,
    cancelled: grouped.cancelled.length,
    needed: Math.max(0, activity.min_volunteers - activity.current_volunteers),
    is_understaffed: activity.current_volunteers < activity.min_volunteers,
  }

  return successResponse({
    activity: {
      id: activity.id,
      title: activity.title,
      start_datetime: activity.start_datetime,
      end_datetime: activity.end_datetime,
      min_volunteers: activity.min_volunteers,
      max_volunteers: activity.max_volunteers,
      current_volunteers: activity.current_volunteers,
    },
    assignments,
    grouped,
    stats,
  })
}
