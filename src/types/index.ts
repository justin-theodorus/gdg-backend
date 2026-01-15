// User roles
export type UserRole = 'participant' | 'caregiver' | 'volunteer' | 'staff'

// Base user type
export interface User {
  id: string
  email: string | null
  phone: string | null
  first_name: string
  last_name: string
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string
}

// JWT payload
export interface JWTPayload {
  userId: string
  email: string | null
  role: UserRole
  iat?: number
  exp?: number
}

// Program type
export interface Program {
  id: string
  name: string
  description: string | null
  color: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// Activity types
export type IntensityLevel = 'low' | 'moderate' | 'high'
export type ActivityType = 'exercise' | 'arts' | 'social' | 'educational' | 'therapy' | 'recreation'

export interface Activity {
  id: string
  program_id: string | null
  title: string
  description: string | null
  start_datetime: string
  end_datetime: string
  location: string | null
  room: string | null
  capacity: number
  current_bookings: number
  min_volunteers: number
  max_volunteers: number
  current_volunteers: number
  activity_type: string | null
  intensity_level: IntensityLevel | null
  accessibility_features: string[]
  tags: string[]
  requirements: string | null
  image_url: string | null
  is_cancelled: boolean
  cancellation_reason: string | null
  series_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  program?: Program
}

// Participant type
export interface Participant {
  id: string
  user_id: string
  date_of_birth: string | null
  membership_type: 'adhoc' | 'weekly' | 'twice_weekly' | '3plus_weekly'
  accessibility_needs: string[]
  dietary_restrictions: string[]
  medical_notes: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  emergency_contact_relationship: string | null
  preferences: Record<string, unknown>
  created_at: string
  updated_at: string
  user?: User
}

// Booking types
export type BookingStatus = 'confirmed' | 'cancelled' | 'completed' | 'no_show'

export interface Booking {
  id: string
  activity_id: string
  participant_id: string
  registered_by: string
  status: BookingStatus
  checked_in_at: string | null
  attended: boolean | null
  feedback_rating: number | null
  feedback_text: string | null
  created_at: string
  cancelled_at: string | null
  activity?: Activity
  participant?: Participant
}

// Waitlist types
export type WaitlistStatus = 'waiting' | 'notified' | 'accepted' | 'declined' | 'expired' | 'cancelled'

export interface WaitlistEntry {
  id: string
  activity_id: string
  participant_id: string
  position: number
  status: WaitlistStatus
  notified_at: string | null
  expires_at: string | null
  created_at: string
  activity?: Activity
  participant?: Participant
}

// Volunteer types
export interface Volunteer {
  id: string
  user_id: string
  interests: string[]
  skills: string[]
  availability: Record<string, string[]>
  rating: number
  total_hours: number
  total_sessions: number
  created_at: string
  updated_at: string
  user?: User
}

export type AssignmentRole = 'facilitator' | 'assistant' | 'setup_crew'
export type AssignmentStatus = 'invited' | 'confirmed' | 'declined' | 'completed' | 'cancelled'

export interface VolunteerAssignment {
  id: string
  activity_id: string
  volunteer_id: string
  role: AssignmentRole
  responsibilities: string | null
  status: AssignmentStatus
  responded_at: string | null
  check_in_time: string | null
  check_out_time: string | null
  hours_contributed: number | null
  staff_rating: number | null
  volunteer_feedback: string | null
  created_at: string
  activity?: Activity
  volunteer?: Volunteer
}

// API response types
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

// Conflict detection
export interface ConflictingActivity {
  activity_id: string
  title: string
  start_datetime: string
  end_datetime: string
  location: string | null
}

export interface ConflictCheckResult {
  has_conflict: boolean
  conflicting_activity?: ConflictingActivity
  alternatives?: Activity[]
}

// Volunteer matching
export interface VolunteerMatch {
  volunteer: Volunteer
  score: number
  breakdown: {
    interest_score: number
    rating_score: number
    experience_score: number
    availability_score: number
  }
}

// Analytics
export interface DashboardStats {
  total_registrations: number
  unique_participants: number
  active_volunteers: number
  average_satisfaction: number
  total_activities: number
  cancellation_rate: number
  popular_activities: Array<{
    activity: Activity
    registration_count: number
  }>
  volunteer_leaderboard: Array<{
    volunteer: Volunteer
    total_hours: number
    total_sessions: number
  }>
}
