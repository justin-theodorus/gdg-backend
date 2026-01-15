import { supabase } from './supabase'

const WAITLIST_EXPIRY_HOURS = 2

// Add participant to waitlist
export async function addToWaitlist(
  activityId: string,
  participantId: string
): Promise<{ success: boolean; position?: number; error?: string }> {
  // Get next position
  const { data: positionData } = await supabase.rpc('get_next_waitlist_position', {
    p_activity_id: activityId,
  })

  const position = positionData || 1

  // Add to waitlist
  const { data: entry, error } = await supabase
    .from('waitlist_entries')
    .insert({
      activity_id: activityId,
      participant_id: participantId,
      position,
      status: 'waiting',
    })
    .select()
    .single()

  if (error) {
    // Check for unique constraint violation (already in waitlist)
    if (error.code === '23505') {
      return { success: false, error: 'Already on waitlist for this activity' }
    }
    console.error('Error adding to waitlist:', error)
    return { success: false, error: 'Failed to add to waitlist' }
  }

  return { success: true, position: entry.position }
}

// Process waitlist when a spot opens up
export async function processWaitlist(activityId: string): Promise<{
  notified: boolean
  participantId?: string
}> {
  // Get next person in waitlist
  const { data: nextEntry, error } = await supabase
    .from('waitlist_entries')
    .select('*, participant:participants(*, user:users(*))')
    .eq('activity_id', activityId)
    .eq('status', 'waiting')
    .order('position', { ascending: true })
    .limit(1)
    .single()

  if (error || !nextEntry) {
    return { notified: false }
  }

  // Calculate expiry time (2 hours from now)
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + WAITLIST_EXPIRY_HOURS)

  // Update waitlist entry to notified
  await supabase
    .from('waitlist_entries')
    .update({
      status: 'notified',
      notified_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
    })
    .eq('id', nextEntry.id)

  // Log notification (in production, this would send actual notification)
  console.log(`[NOTIFICATION] Waitlist spot available for participant ${nextEntry.participant_id}`)
  console.log(`[NOTIFICATION] Offer expires at ${expiresAt.toISOString()}`)

  return {
    notified: true,
    participantId: nextEntry.participant_id,
  }
}

// Accept waitlist offer
export async function acceptWaitlistOffer(
  waitlistId: string,
  registeredBy: string
): Promise<{ success: boolean; bookingId?: string; error?: string }> {
  // Get waitlist entry
  const { data: entry, error: fetchError } = await supabase
    .from('waitlist_entries')
    .select('*, activity:activities(*)')
    .eq('id', waitlistId)
    .single()

  if (fetchError || !entry) {
    return { success: false, error: 'Waitlist entry not found' }
  }

  // Check if offer is still valid
  if (entry.status !== 'notified') {
    return { success: false, error: 'No active offer for this waitlist entry' }
  }

  if (entry.expires_at && new Date(entry.expires_at) < new Date()) {
    // Mark as expired
    await supabase
      .from('waitlist_entries')
      .update({ status: 'expired' })
      .eq('id', waitlistId)

    // Process next person in waitlist
    await processWaitlist(entry.activity_id)

    return { success: false, error: 'Offer has expired' }
  }

  // Check activity still has space (edge case: activity cancelled)
  const activity = entry.activity
  if (activity.is_cancelled) {
    return { success: false, error: 'Activity has been cancelled' }
  }

  // Create booking
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      activity_id: entry.activity_id,
      participant_id: entry.participant_id,
      registered_by: registeredBy,
      status: 'confirmed',
    })
    .select()
    .single()

  if (bookingError) {
    console.error('Error creating booking from waitlist:', bookingError)
    return { success: false, error: 'Failed to create booking' }
  }

  // Update activity booking count
  await supabase
    .from('activities')
    .update({ current_bookings: activity.current_bookings + 1 })
    .eq('id', entry.activity_id)

  // Remove from waitlist
  await supabase
    .from('waitlist_entries')
    .update({ status: 'accepted' })
    .eq('id', waitlistId)

  return { success: true, bookingId: booking.id }
}

// Decline waitlist offer
export async function declineWaitlistOffer(waitlistId: string): Promise<{ success: boolean }> {
  // Get waitlist entry
  const { data: entry, error: fetchError } = await supabase
    .from('waitlist_entries')
    .select('activity_id')
    .eq('id', waitlistId)
    .single()

  if (fetchError || !entry) {
    return { success: false }
  }

  // Mark as declined
  await supabase
    .from('waitlist_entries')
    .update({ status: 'declined' })
    .eq('id', waitlistId)

  // Process next person in waitlist
  await processWaitlist(entry.activity_id)

  return { success: true }
}

// Check and expire old waitlist offers (should be called by a cron job)
export async function expireOldOffers(): Promise<number> {
  const { data: expiredEntries } = await supabase
    .from('waitlist_entries')
    .select('id, activity_id')
    .eq('status', 'notified')
    .lt('expires_at', new Date().toISOString())

  if (!expiredEntries || expiredEntries.length === 0) {
    return 0
  }

  // Mark as expired
  await supabase
    .from('waitlist_entries')
    .update({ status: 'expired' })
    .in('id', expiredEntries.map(e => e.id))

  // Process waitlist for each activity
  const activityIds = [...new Set(expiredEntries.map(e => e.activity_id))]
  for (const activityId of activityIds) {
    await processWaitlist(activityId)
  }

  return expiredEntries.length
}
