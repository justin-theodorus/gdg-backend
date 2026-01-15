import { supabase } from './supabase'
import type { Volunteer, Activity, VolunteerMatch } from '@/types'

// Calculate match score for a volunteer and activity
export function calculateMatchScore(
  volunteer: Volunteer,
  activity: Activity
): { score: number; breakdown: VolunteerMatch['breakdown'] } {
  let interestScore = 0
  let ratingScore = 0
  let experienceScore = 0
  let availabilityScore = 0

  // Interest match (40 points max, 10 per matching tag)
  const activityTags = activity.tags || []
  const volunteerInterests = volunteer.interests || []
  
  for (const tag of activityTags) {
    if (volunteerInterests.includes(tag)) {
      interestScore += 10
    }
  }
  interestScore = Math.min(40, interestScore)

  // Rating score (25 points max, rating × 5)
  ratingScore = Math.min(25, volunteer.rating * 5)

  // Experience score (15 points max, total_hours / 10, capped at 15)
  experienceScore = Math.min(15, volunteer.total_hours / 10)

  // Availability match (20 points)
  const activityDate = new Date(activity.start_datetime)
  const dayOfWeek = activityDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
  const hour = activityDate.getHours()
  
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
  
  const availability = volunteer.availability || {}
  const dayAvailability = availability[dayOfWeek] || []
  
  if (dayAvailability.includes(timeOfDay) || dayAvailability.includes('all')) {
    availabilityScore = 20
  }

  const totalScore = interestScore + ratingScore + experienceScore + availabilityScore

  return {
    score: Math.round(totalScore * 100) / 100,
    breakdown: {
      interest_score: interestScore,
      rating_score: ratingScore,
      experience_score: experienceScore,
      availability_score: availabilityScore,
    },
  }
}

// Find best volunteers for an activity
export async function findVolunteersForActivity(
  activityId: string,
  limit = 5
): Promise<VolunteerMatch[]> {
  // Get activity details
  const { data: activity, error: activityError } = await supabase
    .from('activities')
    .select('*')
    .eq('id', activityId)
    .single()

  if (activityError || !activity) {
    console.error('Activity not found:', activityError)
    return []
  }

  // Get all active volunteers
  const { data: volunteers, error: volunteersError } = await supabase
    .from('volunteers')
    .select('*, user:users(first_name, last_name, email, phone)')

  if (volunteersError || !volunteers) {
    console.error('Error fetching volunteers:', volunteersError)
    return []
  }

  // Get already assigned volunteers for this activity
  const { data: assignments } = await supabase
    .from('volunteer_assignments')
    .select('volunteer_id')
    .eq('activity_id', activityId)
    .in('status', ['invited', 'confirmed'])

  const assignedVolunteerIds = new Set(assignments?.map(a => a.volunteer_id) || [])

  // Check for conflicts with existing assignments
  const activityStart = new Date(activity.start_datetime).getTime()
  const activityEnd = new Date(activity.end_datetime).getTime()

  const availableVolunteers: VolunteerMatch[] = []

  for (const volunteer of volunteers) {
    // Skip already assigned volunteers
    if (assignedVolunteerIds.has(volunteer.id)) continue

    // Check for time conflicts with other assignments
    const { data: volunteerAssignments } = await supabase
      .from('volunteer_assignments')
      .select('activity:activities(start_datetime, end_datetime)')
      .eq('volunteer_id', volunteer.id)
      .in('status', ['confirmed'])

    let hasConflict = false
    for (const assignment of volunteerAssignments || []) {
      const assignedActivity = assignment.activity as unknown as Activity
      if (!assignedActivity) continue

      const assignedStart = new Date(assignedActivity.start_datetime).getTime()
      const assignedEnd = new Date(assignedActivity.end_datetime).getTime()

      if (activityStart < assignedEnd && activityEnd > assignedStart) {
        hasConflict = true
        break
      }
    }

    if (!hasConflict) {
      const { score, breakdown } = calculateMatchScore(volunteer as Volunteer, activity as Activity)
      availableVolunteers.push({
        volunteer: volunteer as Volunteer,
        score,
        breakdown,
      })
    }
  }

  // Sort by score descending and return top matches
  availableVolunteers.sort((a, b) => b.score - a.score)
  return availableVolunteers.slice(0, limit)
}
