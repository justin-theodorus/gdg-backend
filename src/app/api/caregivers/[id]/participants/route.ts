import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { authenticateRequest } from '@/lib/auth'
import { successResponse, errors } from '@/lib/api-utils'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/caregivers/:id/participants - Get caregiver's linked participants
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  // Verify caregiver exists and user has access
  const { data: caregiver, error: caregiverError } = await supabase
    .from('caregivers')
    .select('*, user:users(id)')
    .eq('id', id)
    .single()

  if (caregiverError || !caregiver) {
    return errors.notFound('Caregiver')
  }

  // Check if user is the caregiver or staff
  if (caregiver.user?.id !== auth.userId && auth.role !== 'staff') {
    return errors.forbidden('Can only view your own care recipients')
  }

  // Get linked participants
  const { data: links, error: linksError } = await supabase
    .from('participant_caregivers')
    .select(`
      *,
      participant:participants(
        *,
        user:users(first_name, last_name, email, phone)
      )
    `)
    .eq('caregiver_id', id)

  if (linksError) {
    console.error('Error fetching participants:', linksError)
    return errors.internal('Failed to fetch care recipients')
  }

  // Get upcoming bookings count for each participant
  const participantsWithStats = await Promise.all(
    (links || []).map(async (link) => {
      const { count: upcomingCount } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('participant_id', link.participant.id)
        .eq('status', 'confirmed')
        .gte('activity.start_datetime', new Date().toISOString())

      return {
        ...link.participant,
        is_primary: link.is_primary,
        can_register: link.can_register,
        can_cancel: link.can_cancel,
        upcoming_bookings_count: upcomingCount || 0,
      }
    })
  )

  return successResponse({
    participants: participantsWithStats,
    total: participantsWithStats.length,
  })
}
