import { supabase } from './supabase'
import type { Activity, ConflictCheckResult } from '@/types'

// Check for booking conflicts for a participant
export async function checkBookingConflict(
  participantId: string,
  startDatetime: string,
  endDatetime: string,
  excludeActivityId?: string
): Promise<ConflictCheckResult> {
  // Use the database function to check for conflicts
  const { data: conflicts, error } = await supabase.rpc('check_booking_conflict', {
    p_participant_id: participantId,
    p_start_datetime: startDatetime,
    p_end_datetime: endDatetime,
    p_exclude_activity_id: excludeActivityId || null,
  })

  if (error) {
    console.error('Error checking conflicts:', error)
    // Fallback to manual check
    return await checkBookingConflictManual(participantId, startDatetime, endDatetime, excludeActivityId)
  }

  if (conflicts && conflicts.length > 0) {
    const conflictingActivity = conflicts[0]
    
    // Get alternative suggestions
    const alternatives = await getAlternativeSuggestions(
      participantId,
      startDatetime,
      endDatetime,
      conflictingActivity.activity_id
    )

    return {
      has_conflict: true,
      conflicting_activity: {
        activity_id: conflictingActivity.activity_id,
        title: conflictingActivity.title,
        start_datetime: conflictingActivity.start_datetime,
        end_datetime: conflictingActivity.end_datetime,
        location: conflictingActivity.location,
      },
      alternatives,
    }
  }

  return { has_conflict: false }
}

// Manual conflict check (fallback)
async function checkBookingConflictManual(
  participantId: string,
  startDatetime: string,
  endDatetime: string,
  excludeActivityId?: string
): Promise<ConflictCheckResult> {
  // Get participant's confirmed bookings
  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      activity:activities(
        id, title, start_datetime, end_datetime, location
      )
    `)
    .eq('participant_id', participantId)
    .eq('status', 'confirmed')

  if (!bookings) {
    return { has_conflict: false }
  }

  const newStart = new Date(startDatetime).getTime()
  const newEnd = new Date(endDatetime).getTime()

  for (const booking of bookings) {
    const activity = booking.activity as unknown as Activity
    if (!activity || activity.id === excludeActivityId) continue

    const existingStart = new Date(activity.start_datetime).getTime()
    const existingEnd = new Date(activity.end_datetime).getTime()

    // Check for overlap
    if (newStart < existingEnd && newEnd > existingStart) {
      const alternatives = await getAlternativeSuggestions(
        participantId,
        startDatetime,
        endDatetime,
        activity.id
      )

      return {
        has_conflict: true,
        conflicting_activity: {
          activity_id: activity.id,
          title: activity.title,
          start_datetime: activity.start_datetime,
          end_datetime: activity.end_datetime,
          location: activity.location,
        },
        alternatives,
      }
    }
  }

  return { has_conflict: false }
}

// Get alternative activity suggestions
export async function getAlternativeSuggestions(
  participantId: string,
  originalStart: string,
  originalEnd: string,
  conflictingActivityId: string,
  limit = 3
): Promise<Activity[]> {
  // Get the conflicting activity to find similar ones
  const { data: conflicting } = await supabase
    .from('activities')
    .select('activity_type, tags, program_id')
    .eq('id', conflictingActivityId)
    .single()

  if (!conflicting) {
    return []
  }

  // Get participant's existing booking times to exclude
  const { data: existingBookings } = await supabase
    .from('bookings')
    .select('activity:activities(start_datetime, end_datetime)')
    .eq('participant_id', participantId)
    .eq('status', 'confirmed')

  const bookedTimes = existingBookings?.map(b => {
    const activity = b.activity as unknown as Activity
    return { start: activity.start_datetime, end: activity.end_datetime }
  }) || []

  // Find similar activities that don't conflict
  let query = supabase
    .from('activities')
    .select('*')
    .eq('is_cancelled', false)
    .neq('id', conflictingActivityId)
    .gte('start_datetime', new Date().toISOString())
    .order('start_datetime', { ascending: true })
    .limit(20) // Fetch more to filter

  // Prefer same activity type
  if (conflicting.activity_type) {
    query = query.eq('activity_type', conflicting.activity_type)
  }

  const { data: candidates } = await query

  if (!candidates) {
    return []
  }

  // Filter out activities that conflict with existing bookings
  const alternatives: Activity[] = []
  
  for (const activity of candidates) {
    if (alternatives.length >= limit) break

    // Check if activity has available spots
    if (activity.current_bookings >= activity.capacity) continue

    // Check if this activity conflicts with any existing booking
    const actStart = new Date(activity.start_datetime).getTime()
    const actEnd = new Date(activity.end_datetime).getTime()

    const hasConflict = bookedTimes.some(({ start, end }) => {
      const bookedStart = new Date(start).getTime()
      const bookedEnd = new Date(end).getTime()
      return actStart < bookedEnd && actEnd > bookedStart
    })

    if (!hasConflict) {
      alternatives.push(activity)
    }
  }

  return alternatives
}
