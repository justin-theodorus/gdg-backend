import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { authenticateRequest, permissions } from '@/lib/auth'
import { successResponse, errors, parseQueryParams } from '@/lib/api-utils'

// GET /api/analytics/dashboard - Get dashboard statistics
export async function GET(request: NextRequest) {
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  if (!permissions.canViewAnalytics(auth.role)) {
    return errors.forbidden('Only staff can view analytics')
  }

  const searchParams = parseQueryParams(request)
  
  // Date range filter
  const days = parseInt(searchParams.get('days') || '30', 10)
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  const startDateStr = startDate.toISOString()

  // Total registrations in period
  const { count: totalRegistrations } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startDateStr)

  // Unique participants in period
  const { data: uniqueParticipants } = await supabase
    .from('bookings')
    .select('participant_id')
    .gte('created_at', startDateStr)

  const uniqueParticipantCount = new Set(uniqueParticipants?.map(b => b.participant_id)).size

  // Active volunteers (with confirmed assignments in period)
  const { data: activeVolunteers } = await supabase
    .from('volunteer_assignments')
    .select('volunteer_id')
    .in('status', ['confirmed', 'completed'])
    .gte('created_at', startDateStr)

  const activeVolunteerCount = new Set(activeVolunteers?.map(a => a.volunteer_id)).size

  // Average satisfaction rating
  const { data: ratings } = await supabase
    .from('bookings')
    .select('feedback_rating')
    .not('feedback_rating', 'is', null)
    .gte('created_at', startDateStr)

  const avgRating = ratings && ratings.length > 0
    ? ratings.reduce((sum, b) => sum + (b.feedback_rating || 0), 0) / ratings.length
    : 0

  // Total activities in period
  const { count: totalActivities } = await supabase
    .from('activities')
    .select('*', { count: 'exact', head: true })
    .gte('start_datetime', startDateStr)
    .eq('is_cancelled', false)

  // Cancellation rate
  const { count: cancelledBookings } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'cancelled')
    .gte('created_at', startDateStr)

  const cancellationRate = totalRegistrations && totalRegistrations > 0
    ? ((cancelledBookings || 0) / (totalRegistrations + (cancelledBookings || 0)) * 100)
    : 0

  // Most popular activities (by registration count)
  const { data: popularActivities } = await supabase
    .from('activities')
    .select('id, title, current_bookings, capacity, start_datetime, program:programs(name, color)')
    .eq('is_cancelled', false)
    .gte('start_datetime', startDateStr)
    .order('current_bookings', { ascending: false })
    .limit(10)

  // Volunteer leaderboard
  const { data: volunteerLeaderboard } = await supabase
    .from('volunteers')
    .select('id, total_hours, total_sessions, rating, user:users(first_name, last_name)')
    .order('total_hours', { ascending: false })
    .limit(10)

  // Upcoming activities count
  const { count: upcomingActivities } = await supabase
    .from('activities')
    .select('*', { count: 'exact', head: true })
    .eq('is_cancelled', false)
    .gte('start_datetime', new Date().toISOString())

  // Total waitlist entries
  const { count: waitlistCount } = await supabase
    .from('waitlist_entries')
    .select('*', { count: 'exact', head: true })
    .in('status', ['waiting', 'notified'])

  return successResponse({
    period: {
      days,
      start_date: startDateStr,
      end_date: new Date().toISOString(),
    },
    metrics: {
      total_registrations: totalRegistrations || 0,
      unique_participants: uniqueParticipantCount,
      active_volunteers: activeVolunteerCount,
      average_satisfaction: Math.round(avgRating * 10) / 10,
      total_activities: totalActivities || 0,
      cancellation_rate: Math.round(cancellationRate * 10) / 10,
      upcoming_activities: upcomingActivities || 0,
      waitlist_count: waitlistCount || 0,
    },
    popular_activities: popularActivities?.map(a => ({
      ...a,
      fill_rate: Math.round((a.current_bookings / a.capacity) * 100),
    })),
    volunteer_leaderboard: volunteerLeaderboard?.map((v, i) => ({
      rank: i + 1,
      ...v,
    })),
  })
}
