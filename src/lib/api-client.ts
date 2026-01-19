import type { ApiResponse, Activity, Booking, Volunteer, Participant, Program, DashboardStats, WaitlistEntry, VolunteerAssignment, VolunteerMatch } from '@/types'

const API_BASE = '/api'

// Get token from localStorage (client-side only)
function getToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem('careconnect-auth')
    if (stored) {
      const parsed = JSON.parse(stored)
      return parsed.state?.token || null
    }
  } catch {
    return null
  }
  return null
}

// Generic fetch wrapper with auth
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = getToken()
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    })

    const data = await response.json()

    // Handle 401 - redirect to login
    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('careconnect-auth')
        window.location.href = '/login'
      }
      return { success: false, error: { code: 'UNAUTHORIZED', message: 'Session expired' } }
    }

    return data
  } catch (error) {
    return { 
      success: false, 
      error: { 
        code: 'NETWORK_ERROR', 
        message: 'Network error. Please try again.' 
      } 
    }
  }
}

// Dashboard / Analytics
export async function getDashboardStats(days = 30) {
  return apiFetch<{
    period: { days: number; start_date: string; end_date: string }
    metrics: {
      total_registrations: number
      unique_participants: number
      active_volunteers: number
      average_satisfaction: number
      total_activities: number
      cancellation_rate: number
      upcoming_activities: number
      waitlist_count: number
    }
    popular_activities: Array<Activity & { fill_rate: number }>
    volunteer_leaderboard: Array<{
      rank: number
      id: string
      total_hours: number
      total_sessions: number
      rating: number
      user: { first_name: string; last_name: string }
    }>
  }>(`/analytics/dashboard?days=${days}`)
}

// Activities
export interface ActivityFilters {
  program_id?: string
  activity_type?: string
  intensity_level?: string
  start_date?: string
  end_date?: string
  has_availability?: boolean
  include_past?: boolean
  limit?: number
  offset?: number
}

export async function getActivities(filters: ActivityFilters = {}) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.set(key, String(value))
    }
  })
  return apiFetch<{
    activities: Activity[]
    pagination: { total: number; limit: number; offset: number }
  }>(`/activities?${params}`)
}

export async function getActivity(id: string) {
  return apiFetch<Activity>(`/activities/${id}`)
}

export async function createActivity(data: Partial<Activity>) {
  // Convert datetime-local format to ISO 8601 if needed
  const processedData = { ...data }
  if (processedData.start_datetime && !processedData.start_datetime.includes('Z') && !processedData.start_datetime.includes('+')) {
    processedData.start_datetime = new Date(processedData.start_datetime).toISOString()
  }
  if (processedData.end_datetime && !processedData.end_datetime.includes('Z') && !processedData.end_datetime.includes('+')) {
    processedData.end_datetime = new Date(processedData.end_datetime).toISOString()
  }

  return apiFetch<Activity>('/activities', {
    method: 'POST',
    body: JSON.stringify(processedData),
  })
}

export async function updateActivity(id: string, data: Partial<Activity>) {
  // Convert datetime-local format to ISO 8601 if needed
  const processedData = { ...data }
  if (processedData.start_datetime && !processedData.start_datetime.includes('Z') && !processedData.start_datetime.includes('+')) {
    processedData.start_datetime = new Date(processedData.start_datetime).toISOString()
  }
  if (processedData.end_datetime && !processedData.end_datetime.includes('Z') && !processedData.end_datetime.includes('+')) {
    processedData.end_datetime = new Date(processedData.end_datetime).toISOString()
  }

  return apiFetch<Activity>(`/activities/${id}`, {
    method: 'PUT',
    body: JSON.stringify(processedData),
  })
}

export async function cancelActivity(id: string, reason: string) {
  return apiFetch<Activity>(`/activities/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export async function findVolunteersForActivity(id: string, limit = 5) {
  return apiFetch<{ matches: VolunteerMatch[] }>(`/activities/${id}/find-volunteers?limit=${limit}`)
}

// Bookings
export interface BookingFilters {
  status?: string
  activity_id?: string
  participant_id?: string
  limit?: number
  offset?: number
}

export async function getBookings(filters: BookingFilters = {}) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.set(key, String(value))
    }
  })
  return apiFetch<{
    bookings: Booking[]
    pagination: { total: number; limit: number; offset: number }
  }>(`/bookings?${params}`)
}

export async function getBooking(id: string) {
  return apiFetch<Booking>(`/bookings/${id}`)
}

export async function createBooking(activityId: string, participantId: string) {
  return apiFetch<Booking>('/bookings', {
    method: 'POST',
    body: JSON.stringify({ activity_id: activityId, participant_id: participantId }),
  })
}

export async function cancelBooking(id: string) {
  return apiFetch<Booking>(`/bookings/${id}/cancel`, {
    method: 'POST',
  })
}

// Volunteers
export interface VolunteerFilters {
  skill?: string
  interest?: string
  limit?: number
  offset?: number
}

export async function getVolunteers(filters: VolunteerFilters = {}) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.set(key, String(value))
    }
  })
  return apiFetch<{
    volunteers: Volunteer[]
    pagination: { total: number; limit: number; offset: number }
  }>(`/volunteers?${params}`)
}

export async function getVolunteer(id: string) {
  return apiFetch<Volunteer>(`/volunteers/${id}`)
}

export async function getVolunteerLeaderboard(limit = 10, sortBy = 'total_hours') {
  return apiFetch<{
    leaderboard: Array<{
      rank: number
      id: string
      total_hours: number
      total_sessions: number
      rating: number
      user: { first_name: string; last_name: string }
    }>
    sorted_by: string
  }>(`/volunteers/leaderboard?limit=${limit}&sort_by=${sortBy}`)
}

// Volunteer Assignments
export async function createVolunteerAssignment(
  activityId: string,
  volunteerId: string,
  role: string,
  responsibilities?: string
) {
  return apiFetch<VolunteerAssignment>('/volunteer-assignments', {
    method: 'POST',
    body: JSON.stringify({
      activity_id: activityId,
      volunteer_id: volunteerId,
      role,
      responsibilities,
    }),
  })
}

// Participants
export interface ParticipantFilters {
  limit?: number
  offset?: number
}

export async function getParticipants(filters: ParticipantFilters = {}) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.set(key, String(value))
    }
  })
  return apiFetch<{
    participants: Participant[]
    pagination: { total: number; limit: number; offset: number }
  }>(`/participants?${params}`)
}

export async function getParticipant(id: string) {
  return apiFetch<Participant>(`/participants/${id}`)
}

// Programs
export async function getPrograms() {
  return apiFetch<{ programs: Program[] }>('/programs')
}

// Waitlist
export async function getActivityWaitlist(activityId: string) {
  return apiFetch<{
    entries: WaitlistEntry[]
    total: number
  }>(`/waitlist/activity/${activityId}`)
}

export async function acceptWaitlistEntry(id: string) {
  return apiFetch<Booking>(`/waitlist/${id}/accept`, {
    method: 'POST',
  })
}

export async function declineWaitlistEntry(id: string) {
  return apiFetch<{ message: string }>(`/waitlist/${id}/decline`, {
    method: 'POST',
  })
}

// Clone Activity
export async function cloneActivity(id: string, overrides?: Partial<Activity>) {
  return apiFetch<{ activity: Activity; message: string }>(`/activities/${id}/clone`, {
    method: 'POST',
    body: JSON.stringify(overrides || {}),
  })
}

// Activity Assignments
export interface ActivityAssignmentsResponse {
  activity: {
    id: string
    title: string
    start_datetime: string
    end_datetime: string
    min_volunteers: number
    max_volunteers: number
    current_volunteers: number
  }
  assignments: VolunteerAssignment[]
  grouped: {
    invited: VolunteerAssignment[]
    confirmed: VolunteerAssignment[]
    completed: VolunteerAssignment[]
    declined: VolunteerAssignment[]
    cancelled: VolunteerAssignment[]
  }
  stats: {
    total: number
    invited: number
    confirmed: number
    completed: number
    declined: number
    cancelled: number
    needed: number
    is_understaffed: boolean
  }
}

export async function getActivityAssignments(activityId: string) {
  return apiFetch<ActivityAssignmentsResponse>(`/activities/${activityId}/assignments`)
}

// Complete Volunteer Assignment (with rating)
export async function completeVolunteerAssignment(
  assignmentId: string,
  staffRating: number,
  volunteerFeedback?: string,
  hoursContributed?: number
) {
  return apiFetch<{
    message: string
    assignment_id: string
    hours_contributed: number
    staff_rating: number
    volunteer_new_stats: {
      rating: number
      total_hours: number
      total_sessions: number
    }
  }>(`/volunteer-assignments/${assignmentId}/complete`, {
    method: 'POST',
    body: JSON.stringify({
      staff_rating: staffRating,
      volunteer_feedback: volunteerFeedback,
      hours_contributed: hoursContributed,
    }),
  })
}

// Remind Volunteer
export async function remindVolunteer(assignmentId: string) {
  return apiFetch<{
    message: string
    assignment_id: string
    volunteer: { name: string; email: string | null; phone: string | null }
    activity: { title: string; start_datetime: string; location: string | null }
  }>(`/volunteer-assignments/${assignmentId}/remind`, {
    method: 'POST',
  })
}

// Check-in Participant
export async function checkInBooking(bookingId: string) {
  return apiFetch<{
    message: string
    booking_id: string
    checked_in_at: string
    participant: { name: string }
    activity: { title: string }
  }>(`/bookings/${bookingId}/check-in`, {
    method: 'PUT',
    body: JSON.stringify({ check_in: true }),
  })
}

// Undo Check-in
export async function undoCheckIn(bookingId: string) {
  return apiFetch<{
    message: string
    booking_id: string
    participant: { name: string }
  }>(`/bookings/${bookingId}/check-in`, {
    method: 'PUT',
    body: JSON.stringify({ check_in: false }),
  })
}

// Bulk Check-in
export async function bulkCheckIn(bookingIds: string[]) {
  const results = await Promise.all(
    bookingIds.map(id => checkInBooking(id))
  )
  const successful = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length
  return {
    success: failed === 0,
    data: { successful, failed, total: bookingIds.length },
  }
}
