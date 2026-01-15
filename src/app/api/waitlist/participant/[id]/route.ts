import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { authenticateRequest } from '@/lib/auth'
import { successResponse, errors } from '@/lib/api-utils'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/waitlist/participant/:id - Get participant's waitlist entries
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  const { data: entries, error } = await supabase
    .from('waitlist_entries')
    .select(`
      *,
      activity:activities(*, program:programs(*))
    `)
    .eq('participant_id', id)
    .in('status', ['waiting', 'notified'])
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching waitlist:', error)
    return errors.internal('Failed to fetch waitlist entries')
  }

  // Add expiry info for notified entries
  const entriesWithExpiry = entries?.map(entry => ({
    ...entry,
    is_offer_active: entry.status === 'notified',
    offer_expires_in: entry.expires_at 
      ? Math.max(0, new Date(entry.expires_at).getTime() - Date.now())
      : null,
  }))

  return successResponse({ entries: entriesWithExpiry })
}
