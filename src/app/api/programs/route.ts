import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { authenticateRequest, permissions } from '@/lib/auth'
import { createProgramSchema, validateBody, formatZodError } from '@/lib/validation'
import { successResponse, errorResponse, errors, parseBody, parseQueryParams, getPaginationParams } from '@/lib/api-utils'

// GET /api/programs - List all programs
export async function GET(request: NextRequest) {
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  const searchParams = parseQueryParams(request)
  const { limit, offset } = getPaginationParams(searchParams)
  const includeInactive = searchParams.get('include_inactive') === 'true'

  let query = supabase
    .from('programs')
    .select('*', { count: 'exact' })
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1)

  if (!includeInactive) {
    query = query.eq('is_active', true)
  }

  const { data: programs, error, count } = await query

  if (error) {
    console.error('Error fetching programs:', error)
    return errors.internal('Failed to fetch programs')
  }

  return successResponse({
    programs,
    pagination: {
      total: count,
      limit,
      offset,
    },
  })
}

// POST /api/programs - Create a new program
export async function POST(request: NextRequest) {
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  if (!permissions.canCreateActivity(auth.role)) {
    return errors.forbidden('Only staff can create programs')
  }

  const body = await parseBody(request)
  if (!body) {
    return errorResponse('VALIDATION_ERROR', 'Invalid JSON body', 400)
  }

  const validation = validateBody(createProgramSchema, body)
  if (!validation.success) {
    return errorResponse(
      'VALIDATION_ERROR',
      'Invalid input data',
      400,
      formatZodError(validation.error).details
    )
  }

  const { data: program, error } = await supabase
    .from('programs')
    .insert(validation.data)
    .select()
    .single()

  if (error) {
    console.error('Error creating program:', error)
    return errors.internal('Failed to create program')
  }

  return successResponse(program, 201)
}
