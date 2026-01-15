import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyPassword, generateToken } from '@/lib/auth'
import { loginSchema, validateBody, formatZodError } from '@/lib/validation'
import { successResponse, errorResponse, errors, parseBody } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  const body = await parseBody(request)
  if (!body) {
    return errorResponse('VALIDATION_ERROR', 'Invalid JSON body', 400)
  }

  // Validate input
  const validation = validateBody(loginSchema, body)
  if (!validation.success) {
    return errorResponse(
      'VALIDATION_ERROR',
      'Invalid input data',
      400,
      formatZodError(validation.error).details
    )
  }

  const { email, phone, password } = validation.data

  // Find user by email or phone
  let query = supabase
    .from('users')
    .select('id, email, phone, password_hash, first_name, last_name, role, is_active')

  if (email) {
    query = query.eq('email', email)
  } else if (phone) {
    query = query.eq('phone', phone)
  }

  const { data: user, error } = await query.single()

  if (error || !user) {
    return errorResponse('INVALID_CREDENTIALS', 'Invalid email/phone or password', 401)
  }

  // Check if user is active
  if (!user.is_active) {
    return errorResponse('ACCOUNT_DISABLED', 'This account has been disabled', 403)
  }

  // Verify password
  const isValid = await verifyPassword(password, user.password_hash)
  if (!isValid) {
    return errorResponse('INVALID_CREDENTIALS', 'Invalid email/phone or password', 401)
  }

  // Generate JWT token
  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  })

  // Return user without password hash
  const { password_hash: _, ...userWithoutPassword } = user

  return successResponse({
    user: userWithoutPassword,
    token,
  })
}
