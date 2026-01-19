import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { authenticateRequest } from '@/lib/auth'
import { successResponse, errors } from '@/lib/api-utils'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/volunteers/:id/stats - Get volunteer statistics
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  // Get volunteer profile
  const { data: volunteer, error: volunteerError } = await supabase
    .from('volunteers')
    .select('*, user:users(first_name, last_name)')
    .eq('id', id)
    .single()

  if (volunteerError || !volunteer) {
    return errors.notFound('Volunteer')
  }

  // Get this month's stats
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { data: monthlyAssignments, error: monthlyError } = await supabase
    .from('volunteer_assignments')
    .select('hours_contributed, staff_rating')
    .eq('volunteer_id', id)
    .eq('status', 'completed')
    .gte('check_out_time', startOfMonth.toISOString())

  const monthlyStats = {
    sessions: monthlyAssignments?.length || 0,
    total_hours: monthlyAssignments?.reduce((sum, a) => sum + (a.hours_contributed || 0), 0) || 0,
    avg_rating: 0,
  }

  // Calculate monthly average rating
  const monthlyRatings = monthlyAssignments?.filter(a => a.staff_rating) || []
  if (monthlyRatings.length > 0) {
    monthlyStats.avg_rating = monthlyRatings.reduce((sum, a) => sum + a.staff_rating, 0) / monthlyRatings.length
  }

  // Get recent assignments for activity breakdown
  const { data: recentAssignments } = await supabase
    .from('volunteer_assignments')
    .select(`
      *,
      activity:activities(title, activity_type, start_datetime)
    `)
    .eq('volunteer_id', id)
    .eq('status', 'completed')
    .order('check_out_time', { ascending: false })
    .limit(10)

  // Calculate achievements
  const achievements = []
  
  if ((volunteer.total_hours || 0) >= 100) {
    achievements.push({ id: '100_hours', name: '🥇 100 Hour Club', description: 'Contributed 100+ hours' })
  } else if ((volunteer.total_hours || 0) >= 50) {
    achievements.push({ id: '50_hours', name: '🥈 50 Hour Milestone', description: 'Contributed 50+ hours' })
  } else if ((volunteer.total_hours || 0) >= 25) {
    achievements.push({ id: '25_hours', name: '🥉 25 Hour Milestone', description: 'Contributed 25+ hours' })
  }

  if ((volunteer.rating || 0) >= 4.5) {
    achievements.push({ id: 'top_rated', name: '🌟 Top Rated Volunteer', description: 'Maintained 4.5+ rating' })
  }

  if ((volunteer.total_sessions || 0) >= 20) {
    achievements.push({ id: 'dedicated', name: '💪 Dedicated Volunteer', description: 'Completed 20+ sessions' })
  }

  // Get leaderboard position
  const { data: allVolunteers } = await supabase
    .from('volunteers')
    .select('id, total_hours')
    .order('total_hours', { ascending: false })

  const leaderboardPosition = allVolunteers?.findIndex(v => v.id === id) ?? -1

  return successResponse({
    volunteer: {
      id: volunteer.id,
      name: `${volunteer.user?.first_name || ''} ${volunteer.user?.last_name || ''}`.trim(),
      rating: volunteer.rating || 0,
      total_hours: volunteer.total_hours || 0,
      total_sessions: volunteer.total_sessions || 0,
    },
    this_month: monthlyStats,
    recent_assignments: recentAssignments,
    achievements,
    leaderboard_position: leaderboardPosition + 1, // 1-indexed
  })
}
