import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { authenticateRequest, permissions } from '@/lib/auth'
import { createActivitySchema, validateBody, formatZodError } from '@/lib/validation'
import { successResponse, errorResponse, errors, parseBody, parseQueryParams, getPaginationParams } from '@/lib/api-utils'

// GET /api/activities - List activities with filters
export async function GET(request: NextRequest) {
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  const searchParams = parseQueryParams(request)
  const { limit, offset } = getPaginationParams(searchParams)

  // Build query with filters
  let query = supabase
    .from('activities')
    .select('*, program:programs(*)', { count: 'exact' })
    .eq('is_cancelled', false)
    .order('start_datetime', { ascending: true })
    .range(offset, offset + limit - 1)

  // Apply filters
  const programId = searchParams.get('program_id')
  if (programId) {
    query = query.eq('program_id', programId)
  }

  const activityType = searchParams.get('activity_type')
  if (activityType) {
    query = query.eq('activity_type', activityType)
  }

  const intensityLevel = searchParams.get('intensity_level')
  if (intensityLevel) {
    query = query.eq('intensity_level', intensityLevel)
  }

  const startDate = searchParams.get('start_date')
  if (startDate) {
    query = query.gte('start_datetime', startDate)
  }

  const endDate = searchParams.get('end_date')
  if (endDate) {
    query = query.lte('end_datetime', endDate)
  }

  const hasAvailability = searchParams.get('has_availability')
  if (hasAvailability === 'true') {
    query = query.filter('current_bookings', 'lt', 'capacity')
  }

  // Only show future activities by default
  const includePast = searchParams.get('include_past') === 'true'
  if (!includePast) {
    query = query.gte('start_datetime', new Date().toISOString())
  }

  const { data: activities, error, count } = await query

  if (error) {
    console.error('Error fetching activities:', error)
    return errors.internal('Failed to fetch activities')
  }

  // Calculate available spots for each activity
  const activitiesWithAvailability = activities?.map(activity => ({
    ...activity,
    available_spots: activity.capacity - activity.current_bookings,
  }))

  return successResponse({
    activities: activitiesWithAvailability,
    pagination: {
      total: count,
      limit,
      offset,
    },
  })
}

// POST /api/activities - Create a new activity
export async function POST(request: NextRequest) {
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  if (!permissions.canCreateActivity(auth.role)) {
    return errors.forbidden('Only staff can create activities')
  }

  // Verify user exists in database
  const { data: userExists } = await supabase
    .from('users')
    .select('id')
    .eq('id', auth.userId)
    .single()

  if (!userExists) {
    return errorResponse('INVALID_TOKEN', 'Your session is invalid. Please log in again.', 401)
  }

  const body = await parseBody(request)
  if (!body) {
    return errorResponse('VALIDATION_ERROR', 'Invalid JSON body', 400)
  }

  const validation = validateBody(createActivitySchema, body)
  if (!validation.success) {
    return errorResponse(
      'VALIDATION_ERROR',
      'Invalid input data',
      400,
      formatZodError(validation.error).details
    )
  }

  const activityData = {
    ...validation.data,
    created_by: auth.userId,
  }

  // Check for room conflicts if room is specified
  if (activityData.room) {
    const { data: conflicting } = await supabase
      .from('activities')
      .select('id, title')
      .eq('room', activityData.room)
      .eq('is_cancelled', false)
      .or(`and(start_datetime.lte.${activityData.end_datetime},end_datetime.gte.${activityData.start_datetime})`)
      .limit(1)

    if (conflicting && conflicting.length > 0) {
      return errorResponse(
        'ROOM_CONFLICT',
        `Room is already booked for "${conflicting[0].title}"`,
        400
      )
    }
  }

  const { data: activity, error } = await supabase
    .from('activities')
    .insert(activityData)
    .select('*, program:programs(*)')
    .single()

  if (error) {
    console.error('Error creating activity:', error)
    return errors.internal('Failed to create activity')
  }

  return successResponse(activity, 201)
}
