import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { authenticateRequest, permissions } from '@/lib/auth'
import { createParticipantSchema, validateBody, formatZodError } from '@/lib/validation'
import { successResponse, errorResponse, errors, parseBody, parseQueryParams, getPaginationParams } from '@/lib/api-utils'

// GET /api/participants - List participants (staff only)
export async function GET(request: NextRequest) {
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  if (!permissions.canViewAllBookings(auth.role)) {
    return errors.forbidden('Only staff can list all participants')
  }

  const searchParams = parseQueryParams(request)
  const { limit, offset } = getPaginationParams(searchParams)

  const { data: participants, error, count } = await supabase
    .from('participants')
    .select('*, user:users(first_name, last_name, email, phone)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('Error fetching participants:', error)
    return errors.internal('Failed to fetch participants')
  }

  return successResponse({
    participants,
    pagination: {
      total: count,
      limit,
      offset,
    },
  })
}

// POST /api/participants - Create participant profile
export async function POST(request: NextRequest) {
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  const body = await parseBody(request)
  if (!body) {
    return errorResponse('VALIDATION_ERROR', 'Invalid JSON body', 400)
  }

  const validation = validateBody(createParticipantSchema, body)
  if (!validation.success) {
    return errorResponse(
      'VALIDATION_ERROR',
      'Invalid input data',
      400,
      formatZodError(validation.error).details
    )
  }

  // For non-staff, can only create their own profile
  if (!permissions.canManageUsers(auth.role) && validation.data.user_id !== auth.userId) {
    return errors.forbidden('Can only create your own participant profile')
  }

  const { data: participant, error } = await supabase
    .from('participants')
    .insert(validation.data)
    .select('*, user:users(first_name, last_name, email)')
    .single()

  if (error) {
    if (error.code === '23505') {
      return errors.conflict('Participant profile already exists for this user')
    }
    console.error('Error creating participant:', error)
    return errors.internal('Failed to create participant profile')
  }

  return successResponse(participant, 201)
}
