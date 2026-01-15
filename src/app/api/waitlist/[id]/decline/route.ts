import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { declineWaitlistOffer } from '@/lib/waitlist'
import { successResponse, errors } from '@/lib/api-utils'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/waitlist/:id/decline - Decline waitlist offer
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  const result = await declineWaitlistOffer(id)

  if (!result.success) {
    return errors.notFound('Waitlist entry')
  }

  return successResponse({
    message: 'Waitlist offer declined. Next person in line has been notified.',
  })
}
