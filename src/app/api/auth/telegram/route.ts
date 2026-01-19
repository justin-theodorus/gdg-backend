import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { hashPassword, generateToken } from '@/lib/auth'
import { successResponse, errorResponse, errors, parseBody } from '@/lib/api-utils'
import { z } from 'zod'

// Schema for Telegram login
const telegramLoginSchema = z.object({
  telegram_id: z.string().min(1, 'Telegram ID is required'),
})

// Schema for linking Telegram account
const telegramLinkSchema = z.object({
  telegram_id: z.string().min(1, 'Telegram ID is required'),
  user_id: z.string().uuid('Invalid user ID'),
})

// Schema for Telegram registration
const telegramRegisterSchema = z.object({
  telegram_id: z.string().min(1, 'Telegram ID is required'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().optional().default(''),
  role: z.enum(['participant', 'caregiver', 'volunteer']),
})

// POST /api/auth/telegram - Login with Telegram ID or register new user
export async function POST(request: NextRequest) {
  const body = await parseBody(request) as { action?: string } & Record<string, unknown>
  if (!body) {
    return errorResponse('VALIDATION_ERROR', 'Invalid JSON body', 400)
  }

  const { action } = body

  // Handle different actions
  switch (action) {
    case 'login':
      return handleTelegramLogin(body)
    case 'register':
      return handleTelegramRegister(body)
    case 'link':
      return handleTelegramLink(body)
    default:
      return handleTelegramLogin(body) // Default to login for backward compatibility
  }
}

// Login with Telegram ID
async function handleTelegramLogin(body: Record<string, unknown>) {
  const validation = telegramLoginSchema.safeParse(body)
  if (!validation.success) {
    return errorResponse('VALIDATION_ERROR', 'Invalid input data', 400, {
      errors: validation.error.issues,
    })
  }

  const { telegram_id } = validation.data

  // Find user by telegram_id
  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, phone, first_name, last_name, role, is_active, telegram_id')
    .eq('telegram_id', telegram_id)
    .single()

  if (error || !user) {
    return successResponse({ found: false, user: null, token: null })
  }

  if (!user.is_active) {
    return errorResponse('ACCOUNT_DISABLED', 'This account has been disabled', 403)
  }

  // Get participant/caregiver/volunteer ID if applicable
  let participant_id = null
  let caregiver_id = null
  let volunteer_id = null

  if (user.role === 'participant') {
    const { data: participant } = await supabase
      .from('participants')
      .select('id')
      .eq('user_id', user.id)
      .single()
    participant_id = participant?.id
  } else if (user.role === 'caregiver') {
    const { data: caregiver } = await supabase
      .from('caregivers')
      .select('id')
      .eq('user_id', user.id)
      .single()
    caregiver_id = caregiver?.id
  } else if (user.role === 'volunteer') {
    const { data: volunteer } = await supabase
      .from('volunteers')
      .select('id')
      .eq('user_id', user.id)
      .single()
    volunteer_id = volunteer?.id
  }

  // Generate JWT token
  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  })

  return successResponse({
    found: true,
    user: {
      ...user,
      participant_id,
      caregiver_id,
      volunteer_id,
    },
    token,
  })
}

// Register new user with Telegram ID
async function handleTelegramRegister(body: Record<string, unknown>) {
  const validation = telegramRegisterSchema.safeParse(body)
  if (!validation.success) {
    return errorResponse('VALIDATION_ERROR', 'Invalid input data', 400, {
      errors: validation.error.issues,
    })
  }

  const { telegram_id, email, password, first_name, last_name, role } = validation.data

  // Check if telegram_id already exists
  const { data: existingTelegram } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', telegram_id)
    .single()

  if (existingTelegram) {
    return errors.conflict('Telegram account already registered')
  }

  // Check if email already exists
  const { data: existingEmail } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single()

  if (existingEmail) {
    return errors.conflict('Email already registered')
  }

  // Hash password
  const password_hash = await hashPassword(password)

  // Create user with telegram_id
  const { data: user, error } = await supabase
    .from('users')
    .insert({
      email,
      password_hash,
      first_name,
      last_name: last_name || '',
      role,
      telegram_id,
    })
    .select('id, email, first_name, last_name, role, telegram_id, created_at')
    .single()

  if (error) {
    console.error('Error creating user:', error)
    return errors.internal('Failed to create user')
  }

  // Create role-specific profile
  let participant_id = null
  let caregiver_id = null
  let volunteer_id = null

  if (role === 'participant') {
    const { data: participant } = await supabase
      .from('participants')
      .insert({ user_id: user.id })
      .select('id')
      .single()
    participant_id = participant?.id
  } else if (role === 'caregiver') {
    const { data: caregiver } = await supabase
      .from('caregivers')
      .insert({ user_id: user.id })
      .select('id')
      .single()
    caregiver_id = caregiver?.id
  } else if (role === 'volunteer') {
    const { data: volunteer } = await supabase
      .from('volunteers')
      .insert({ user_id: user.id })
      .select('id')
      .single()
    volunteer_id = volunteer?.id
  }

  // Generate JWT token
  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  })

  return successResponse({
    user: {
      ...user,
      participant_id,
      caregiver_id,
      volunteer_id,
    },
    token,
  }, 201)
}

// Link Telegram ID to existing user
async function handleTelegramLink(body: Record<string, unknown>) {
  const validation = telegramLinkSchema.safeParse(body)
  if (!validation.success) {
    return errorResponse('VALIDATION_ERROR', 'Invalid input data', 400, {
      errors: validation.error.issues,
    })
  }

  const { telegram_id, user_id } = validation.data

  // Check if telegram_id already linked to another user
  const { data: existingLink } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', telegram_id)
    .single()

  if (existingLink && existingLink.id !== user_id) {
    return errors.conflict('Telegram account already linked to another user')
  }

  // Update user with telegram_id
  const { data: user, error } = await supabase
    .from('users')
    .update({ telegram_id })
    .eq('id', user_id)
    .select('id, email, first_name, last_name, role, telegram_id')
    .single()

  if (error || !user) {
    console.error('Error linking telegram:', error)
    return errors.internal('Failed to link Telegram account')
  }

  return successResponse({
    message: 'Telegram account linked successfully',
    user,
  })
}
