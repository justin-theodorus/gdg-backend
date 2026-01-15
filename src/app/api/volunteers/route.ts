import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { authenticateRequest, permissions } from '@/lib/auth'
import { createVolunteerSchema, validateBody, formatZodError } from '@/lib/validation'
import { successResponse, errorResponse, errors, parseBody, parseQueryParams, getPaginationParams } from '@/lib/api-utils'

// GET /api/volunteers - List volunteers
export async function GET(request: NextRequest) {
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  const searchParams = parseQueryParams(request)
  const { limit, offset } = getPaginationParams(searchParams)

  let query = supabase
    .from('volunteers')
    .select('*, user:users(first_name, last_name, email, phone)', { count: 'exact' })
    .order('rating', { ascending: false })
    .range(offset, offset + limit - 1)

  // Filter by skill
  const skill = searchParams.get('skill')
  if (skill) {
    query = query.contains('skills', [skill])
  }

  // Filter by interest
  const interest = searchParams.get('interest')
  if (interest) {
    query = query.contains('interests', [interest])
  }

  const { data: volunteers, error, count } = await query

  if (error) {
    console.error('Error fetching volunteers:', error)
    return errors.internal('Failed to fetch volunteers')
  }

  return successResponse({
    volunteers,
    pagination: {
      total: count,
      limit,
      offset,
    },
  })
}

// POST /api/volunteers - Create volunteer profile
export async function POST(request: NextRequest) {
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  const body = await parseBody(request)
  if (!body) {
    return errorResponse('VALIDATION_ERROR', 'Invalid JSON body', 400)
  }

  const validation = validateBody(createVolunteerSchema, body)
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
    return errors.forbidden('Can only create your own volunteer profile')
  }

  const { data: volunteer, error } = await supabase
    .from('volunteers')
    .insert(validation.data)
    .select('*, user:users(first_name, last_name, email)')
    .single()

  if (error) {
    if (error.code === '23505') {
      return errors.conflict('Volunteer profile already exists for this user')
    }
    console.error('Error creating volunteer:', error)
    return errors.internal('Failed to create volunteer profile')
  }

  return successResponse(volunteer, 201)
}
