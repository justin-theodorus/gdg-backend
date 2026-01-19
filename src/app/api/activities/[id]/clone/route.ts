import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { authenticateRequest, permissions } from '@/lib/auth'
import { successResponse, errorResponse, errors, parseBody } from '@/lib/api-utils'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/activities/:id/clone - Clone an existing activity
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  if (!permissions.canCreateActivity(auth.role)) {
    return errors.forbidden('Only staff can clone activities')
  }

  // Get original activity
  const { data: original, error: fetchError } = await supabase
    .from('activities')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !original) {
    return errors.notFound('Activity')
  }

  // Parse optional overrides from request body
  const body = await parseBody(request) as Record<string, unknown> | null
  const overrides = body || {}

  // Create cloned activity (exclude fields that shouldn't be copied)
  const clonedData = {
    program_id: (overrides.program_id as string | undefined) ?? original.program_id,
    title: (overrides.title as string | undefined) ?? `${original.title} (Copy)`,
    description: (overrides.description as string | undefined) ?? original.description,
    start_datetime: (overrides.start_datetime as string | undefined) ?? original.start_datetime,
    end_datetime: (overrides.end_datetime as string | undefined) ?? original.end_datetime,
    location: (overrides.location as string | undefined) ?? original.location,
    room: (overrides.room as string | undefined) ?? original.room,
    capacity: (overrides.capacity as number | undefined) ?? original.capacity,
    min_volunteers: (overrides.min_volunteers as number | undefined) ?? original.min_volunteers,
    max_volunteers: (overrides.max_volunteers as number | undefined) ?? original.max_volunteers,
    activity_type: (overrides.activity_type as string | undefined) ?? original.activity_type,
    intensity_level: (overrides.intensity_level as string | undefined) ?? original.intensity_level,
    accessibility_features: (overrides.accessibility_features as string[] | undefined) ?? original.accessibility_features,
    tags: (overrides.tags as string[] | undefined) ?? original.tags,
    requirements: (overrides.requirements as string | undefined) ?? original.requirements,
    image_url: (overrides.image_url as string | undefined) ?? original.image_url,
    // Reset these fields for the clone
    current_bookings: 0,
    current_volunteers: 0,
    is_cancelled: false,
    cancellation_reason: null,
    series_id: original.series_id, // Keep series link if exists
    created_by: auth.userId,
  }

  const { data: cloned, error: insertError } = await supabase
    .from('activities')
    .insert(clonedData)
    .select('*, program:programs(*)')
    .single()

  if (insertError) {
    console.error('Error cloning activity:', insertError)
    return errors.internal('Failed to clone activity')
  }

  return successResponse({
    activity: cloned,
    message: 'Activity cloned successfully',
  }, 201)
}
