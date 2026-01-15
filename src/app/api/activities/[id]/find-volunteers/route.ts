import { NextRequest } from 'next/server'
import { authenticateRequest, permissions } from '@/lib/auth'
import { findVolunteersForActivity } from '@/lib/volunteer-matching'
import { successResponse, errors, parseQueryParams } from '@/lib/api-utils'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/activities/:id/find-volunteers - Find matched volunteers for activity
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  if (!permissions.canAssignVolunteers(auth.role)) {
    return errors.forbidden('Only staff can search for volunteers')
  }

  const searchParams = parseQueryParams(request)
  const limit = Math.min(20, parseInt(searchParams.get('limit') || '5', 10))

  const matches = await findVolunteersForActivity(id, limit)

  return successResponse({
    activity_id: id,
    matches,
    total_matches: matches.length,
  })
}
