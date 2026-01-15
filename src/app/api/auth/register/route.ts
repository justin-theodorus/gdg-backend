import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { hashPassword, generateToken } from '@/lib/auth'
import { registerSchema, validateBody, formatZodError } from '@/lib/validation'
import { successResponse, errorResponse, errors, parseBody } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  const body = await parseBody(request)
  if (!body) {
    return errorResponse('VALIDATION_ERROR', 'Invalid JSON body', 400)
  }

  // Validate input
  const validation = validateBody(registerSchema, body)
  if (!validation.success) {
    return errorResponse(
      'VALIDATION_ERROR',
      'Invalid input data',
      400,
      formatZodError(validation.error).details
    )
  }

  const { email, phone, password, first_name, last_name, role } = validation.data

  // Check if user already exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .or(`email.eq.${email},phone.eq.${phone}`)
    .single()

  if (existingUser) {
    return errors.conflict('User with this email or phone already exists')
  }

  // Hash password
  const password_hash = await hashPassword(password)

  // Create user
  const { data: user, error } = await supabase
    .from('users')
    .insert({
      email,
      phone,
      password_hash,
      first_name,
      last_name,
      role,
    })
    .select('id, email, phone, first_name, last_name, role, created_at')
    .single()

  if (error) {
    console.error('Error creating user:', error)
    return errors.internal('Failed to create user')
  }

  // Create role-specific profile
  if (role === 'participant') {
    await supabase.from('participants').insert({ user_id: user.id })
  } else if (role === 'caregiver') {
    await supabase.from('caregivers').insert({ user_id: user.id })
  } else if (role === 'volunteer') {
    await supabase.from('volunteers').insert({ user_id: user.id })
  }

  // Generate JWT token
  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  })

  return successResponse({
    user,
    token,
  }, 201)
}
