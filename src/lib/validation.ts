import { z } from 'zod'

// User schemas
export const registerSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(10).max(20).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  role: z.enum(['participant', 'caregiver', 'volunteer', 'staff']),
}).refine(data => data.email || data.phone, {
  message: 'Either email or phone is required',
})

export const loginSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  password: z.string().min(1, 'Password is required'),
}).refine(data => data.email || data.phone, {
  message: 'Either email or phone is required',
})

// Program schemas
export const createProgramSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
})

export const updateProgramSchema = createProgramSchema.partial()

// Activity schemas
export const createActivitySchema = z.object({
  program_id: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  start_datetime: z.string().datetime(),
  end_datetime: z.string().datetime(),
  location: z.string().max(255).optional(),
  room: z.string().max(100).optional(),
  capacity: z.number().int().positive(),
  min_volunteers: z.number().int().min(0).optional(),
  max_volunteers: z.number().int().min(0).optional(),
  activity_type: z.string().max(50).optional(),
  intensity_level: z.enum(['low', 'moderate', 'high']).optional(),
  accessibility_features: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  requirements: z.string().optional(),
}).refine(data => new Date(data.end_datetime) > new Date(data.start_datetime), {
  message: 'End datetime must be after start datetime',
}).refine(data => new Date(data.start_datetime) > new Date(), {
  message: 'Cannot create activities in the past',
})

export const updateActivitySchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  start_datetime: z.string().datetime().optional(),
  end_datetime: z.string().datetime().optional(),
  location: z.string().max(255).optional(),
  room: z.string().max(100).optional(),
  capacity: z.number().int().positive().optional(),
  min_volunteers: z.number().int().min(0).optional(),
  max_volunteers: z.number().int().min(0).optional(),
  activity_type: z.string().max(50).optional(),
  intensity_level: z.enum(['low', 'moderate', 'high']).optional(),
  accessibility_features: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  requirements: z.string().optional(),
})

// Booking schemas
export const createBookingSchema = z.object({
  activity_id: z.string().uuid(),
  participant_id: z.string().uuid(),
})

// Participant schemas
export const createParticipantSchema = z.object({
  user_id: z.string().uuid(),
  date_of_birth: z.string().optional(),
  membership_type: z.enum(['adhoc', 'weekly', 'twice_weekly', '3plus_weekly']).optional(),
  accessibility_needs: z.array(z.string()).optional(),
  dietary_restrictions: z.array(z.string()).optional(),
  medical_notes: z.string().optional(),
  emergency_contact_name: z.string().max(100).optional(),
  emergency_contact_phone: z.string().max(20).optional(),
  emergency_contact_relationship: z.string().max(50).optional(),
})

export const updateParticipantSchema = createParticipantSchema.partial().omit({ user_id: true })

// Volunteer schemas
export const createVolunteerSchema = z.object({
  user_id: z.string().uuid(),
  interests: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),
  availability: z.record(z.string(), z.array(z.string())).optional(),
})

export const updateVolunteerSchema = createVolunteerSchema.partial().omit({ user_id: true })

// Volunteer assignment schemas
export const createAssignmentSchema = z.object({
  activity_id: z.string().uuid(),
  volunteer_id: z.string().uuid(),
  role: z.enum(['facilitator', 'assistant', 'setup_crew']).optional(),
  responsibilities: z.string().optional(),
})

export const respondAssignmentSchema = z.object({
  response: z.enum(['accepted', 'declined']),
})

// Analytics query schemas
export const dateRangeSchema = z.object({
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
})

// Validation helper
export function validateBody<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: z.ZodError<T> } {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return { success: false, error: result.error }
}

// Format Zod errors for API response
export function formatZodError<T>(error: z.ZodError<T>) {
  return {
    code: 'VALIDATION_ERROR',
    message: 'Invalid input data',
    details: error.issues.reduce((acc: Record<string, string>, err) => {
      const path = err.path.join('.')
      acc[path] = err.message
      return acc
    }, {}),
  }
}
