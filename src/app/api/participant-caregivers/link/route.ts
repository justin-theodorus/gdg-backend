import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { authenticateRequest } from '@/lib/auth'
import { successResponse, errorResponse, errors, parseBody } from '@/lib/api-utils'
import { z } from 'zod'

const linkSchema = z.object({
  caregiver_id: z.string().uuid(),
  participant_id: z.string().uuid().optional(),
  participant_email: z.string().email().optional(),
  is_primary: z.boolean().default(false),
  can_register: z.boolean().default(true),
  can_cancel: z.boolean().default(true),
})

// POST /api/participant-caregivers/link - Link a participant to a caregiver
export async function POST(request: NextRequest) {
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  const body = await parseBody(request)
  if (!body) {
    return errorResponse('VALIDATION_ERROR', 'Invalid JSON body', 400)
  }

  const validation = linkSchema.safeParse(body)
  if (!validation.success) {
    return errorResponse('VALIDATION_ERROR', 'Invalid input data', 400)
  }

  const { caregiver_id, participant_id, participant_email, is_primary, can_register, can_cancel } = validation.data

  // Verify caregiver exists and user has access
  const { data: caregiver, error: caregiverError } = await supabase
    .from('caregivers')
    .select('*, user:users(id)')
    .eq('id', caregiver_id)
    .single()

  if (caregiverError || !caregiver) {
    return errors.notFound('Caregiver')
  }

  // Only the caregiver themselves or staff can link participants
  if (caregiver.user?.id !== auth.userId && auth.role !== 'staff') {
    return errors.forbidden('Can only link to your own caregiver profile')
  }

  // Find participant by ID or email
  let resolvedParticipantId = participant_id

  if (!resolvedParticipantId && participant_email) {
    // Find participant by email
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('email', participant_email)
      .single()

    if (user) {
      const { data: participant } = await supabase
        .from('participants')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (participant) {
        resolvedParticipantId = participant.id
      }
    }
  }

  if (!resolvedParticipantId) {
    return errorResponse('PARTICIPANT_NOT_FOUND', 'Participant not found. They must register first.', 404)
  }

  // Check if already linked
  const { data: existingLink } = await supabase
    .from('participant_caregivers')
    .select('id')
    .eq('caregiver_id', caregiver_id)
    .eq('participant_id', resolvedParticipantId)
    .single()

  if (existingLink) {
    return errors.conflict('Already linked to this participant')
  }

  // Create the link
  const { data: link, error: linkError } = await supabase
    .from('participant_caregivers')
    .insert({
      caregiver_id,
      participant_id: resolvedParticipantId,
      is_primary,
      can_register,
      can_cancel,
    })
    .select(`
      *,
      participant:participants(*, user:users(first_name, last_name, email))
    `)
    .single()

  if (linkError) {
    console.error('Error creating link:', linkError)
    return errors.internal('Failed to link participant')
  }

  return successResponse({
    message: 'Successfully linked participant',
    link,
  }, 201)
}
