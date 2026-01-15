import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { acceptWaitlistOffer } from '@/lib/waitlist'
import { successResponse, errorResponse, errors } from '@/lib/api-utils'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/waitlist/:id/accept - Accept waitlist offer
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  const result = await acceptWaitlistOffer(id, auth.userId)

  if (!result.success) {
    return errorResponse('WAITLIST_ERROR', result.error || 'Failed to accept offer', 400)
  }

  return successResponse({
    message: 'Waitlist offer accepted. Booking confirmed!',
    booking_id: result.bookingId,
  })
}
