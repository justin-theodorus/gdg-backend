import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { authenticateRequest } from '@/lib/auth'
import { successResponse, errors } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  // Authenticate request
  const auth = authenticateRequest(request)
  if (!auth) {
    return errors.unauthorized()
  }

  // Fetch user with role-specific profile
  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, phone, first_name, last_name, role, is_active, created_at, updated_at')
    .eq('id', auth.userId)
    .single()

  if (error || !user) {
    return errors.notFound('User')
  }

  // Fetch role-specific profile
  let profile = null
  if (user.role === 'participant') {
    const { data } = await supabase
      .from('participants')
      .select('*')
      .eq('user_id', user.id)
      .single()
    profile = data
  } else if (user.role === 'caregiver') {
    const { data } = await supabase
      .from('caregivers')
      .select('*')
      .eq('user_id', user.id)
      .single()
    profile = data
  } else if (user.role === 'volunteer') {
    const { data } = await supabase
      .from('volunteers')
      .select('*')
      .eq('user_id', user.id)
      .single()
    profile = data
  }

  return successResponse({
    user,
    profile,
  })
}
