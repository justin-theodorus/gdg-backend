import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { authenticateRequest } from '@/lib/auth'
import { successResponse, errors, parseQueryParams } from '@/lib/api-utils'

// GET /api/volunteers/leaderboard - Get top volunteers
export async function GET(request: NextRequest) {
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  const searchParams = parseQueryParams(request)
  const limit = Math.min(50, parseInt(searchParams.get('limit') || '10', 10))
  const sortBy = searchParams.get('sort_by') || 'total_hours'

  let orderColumn = 'total_hours'
  if (sortBy === 'rating') orderColumn = 'rating'
  else if (sortBy === 'sessions') orderColumn = 'total_sessions'

  const { data: volunteers, error } = await supabase
    .from('volunteers')
    .select('*, user:users(first_name, last_name)')
    .order(orderColumn, { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching leaderboard:', error)
    return errors.internal('Failed to fetch leaderboard')
  }

  // Add rank to each volunteer
  const rankedVolunteers = volunteers?.map((v, index) => ({
    rank: index + 1,
    ...v,
  }))

  return successResponse({
    leaderboard: rankedVolunteers,
    sorted_by: sortBy,
  })
}
