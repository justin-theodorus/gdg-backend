import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { authenticateRequest, permissions } from '@/lib/auth'
import { updateProgramSchema, validateBody, formatZodError } from '@/lib/validation'
import { successResponse, errorResponse, errors, parseBody } from '@/lib/api-utils'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/programs/:id - Get program details
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  const { data: program, error } = await supabase
    .from('programs')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !program) {
    return errors.notFound('Program')
  }

  // Get activity count for this program
  const { count } = await supabase
    .from('activities')
    .select('*', { count: 'exact', head: true })
    .eq('program_id', id)
    .eq('is_cancelled', false)

  return successResponse({
    ...program,
    activity_count: count || 0,
  })
}

// PUT /api/programs/:id - Update program
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  if (!permissions.canModifyActivity(auth.role)) {
    return errors.forbidden('Only staff can update programs')
  }

  const body = await parseBody(request)
  if (!body) {
    return errorResponse('VALIDATION_ERROR', 'Invalid JSON body', 400)
  }

  const validation = validateBody(updateProgramSchema, body)
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
    .update(validation.data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating program:', error)
    return errors.notFound('Program')
  }

  return successResponse(program)
}

// DELETE /api/programs/:id - Soft delete program
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  if (!permissions.canModifyActivity(auth.role)) {
    return errors.forbidden('Only staff can delete programs')
  }

  const { error } = await supabase
    .from('programs')
    .update({ is_active: false })
    .eq('id', id)

  if (error) {
    console.error('Error deleting program:', error)
    return errors.internal('Failed to delete program')
  }

  return successResponse({ message: 'Program deleted successfully' })
}
