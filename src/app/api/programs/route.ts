import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { authenticateRequest } from '@/lib/auth'
import { successResponse, errors } from '@/lib/api-utils'

// GET /api/programs - List all programs
export async function GET(request: NextRequest) {
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  const { data: programs, error } = await supabase
    .from('programs')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching programs:', error)
    return errors.internal('Failed to fetch programs')
  }

  return successResponse({ programs })
}
