import { NextResponse } from 'next/server'
import type { ApiResponse } from '@/types'

// Success response helper
export function successResponse<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status }
  )
}

// Error response helper
export function errorResponse(
  code: string,
  message: string,
  status = 400,
  details?: Record<string, unknown>
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        details,
      },
    },
    { status }
  )
}

// Common error responses
export const errors = {
  notFound: (resource: string) =>
    errorResponse('NOT_FOUND', `${resource} not found`, 404),
  
  unauthorized: (message = 'Authentication required') =>
    errorResponse('UNAUTHORIZED', message, 401),
  
  forbidden: (message = 'Insufficient permissions') =>
    errorResponse('FORBIDDEN', message, 403),
  
  validationError: (details: Record<string, string>) =>
    errorResponse('VALIDATION_ERROR', 'Invalid input data', 400, details),
  
  conflict: (message: string) =>
    errorResponse('CONFLICT', message, 409),
  
  internal: (message = 'Internal server error') =>
    errorResponse('INTERNAL_ERROR', message, 500),
  
  bookingConflict: (conflictDetails: Record<string, unknown>) =>
    errorResponse('BOOKING_CONFLICT', 'Time conflict detected', 400, conflictDetails),
  
  capacityFull: (waitlistPosition?: number) =>
    errorResponse('CAPACITY_FULL', 'Activity is at full capacity', 400, 
      waitlistPosition ? { waitlist_position: waitlistPosition } : undefined),
  
  alreadyRegistered: () =>
    errorResponse('ALREADY_REGISTERED', 'Already registered for this activity', 409),
}

// Parse request body safely
export async function parseBody<T>(request: Request): Promise<T | null> {
  try {
    return await request.json() as T
  } catch {
    return null
  }
}

// Parse query parameters
export function parseQueryParams(request: Request): URLSearchParams {
  const url = new URL(request.url)
  return url.searchParams
}

// Pagination helper
export function getPaginationParams(searchParams: URLSearchParams): { page: number; limit: number; offset: number } {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
  const offset = (page - 1) * limit
  return { page, limit, offset }
}
