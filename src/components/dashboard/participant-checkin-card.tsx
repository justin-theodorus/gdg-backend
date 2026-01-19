'use client'

import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { CheckCircle, Clock, Accessibility, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import type { Booking } from '@/types'

interface ParticipantCheckInCardProps {
  booking: Booking
  isChecking: boolean
  onCheckIn: () => void
  onUndoCheckIn: () => void
}

export function ParticipantCheckInCard({
  booking,
  isChecking,
  onCheckIn,
  onUndoCheckIn,
}: ParticipantCheckInCardProps) {
  const participant = booking.participant as any
  const user = participant?.user
  const isCheckedIn = !!booking.checked_in_at

  const accessibilityNeeds = participant?.accessibility_needs || []
  const hasAccessibilityNeeds = Array.isArray(accessibilityNeeds) && accessibilityNeeds.length > 0

  return (
    <div
      className={cn(
        'flex items-center justify-between p-4 rounded-lg border transition-colors',
        isCheckedIn
          ? 'border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800'
          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900'
      )}
    >
      <div className="flex items-center gap-3">
        {/* Check Status Icon */}
        <div
          className={cn(
            'flex items-center justify-center h-10 w-10 rounded-full',
            isCheckedIn
              ? 'bg-green-100 dark:bg-green-900'
              : 'bg-slate-100 dark:bg-slate-800'
          )}
        >
          {isCheckedIn ? (
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
          ) : (
            <Clock className="h-5 w-5 text-slate-400" />
          )}
        </div>

        {/* Participant Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium text-slate-900 dark:text-slate-100">
              {user?.first_name} {user?.last_name}
            </p>
            {hasAccessibilityNeeds && (
              <Badge variant="outline" className="text-xs border-blue-500 text-blue-600">
                <Accessibility className="h-3 w-3 mr-1" />
                Needs support
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            {participant?.membership_type && (
              <Badge variant="secondary" className="text-xs capitalize">
                {participant.membership_type.replace('_', ' ')}
              </Badge>
            )}
            {isCheckedIn && booking.checked_in_at && (
              <span className="text-green-600 dark:text-green-400">
                Checked in at {format(new Date(booking.checked_in_at), 'h:mm a')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="flex items-center gap-2">
        {isCheckedIn ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onUndoCheckIn}
            disabled={isChecking}
            className="text-slate-500 hover:text-slate-700"
          >
            {isChecking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Undo'
            )}
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={onCheckIn}
            disabled={isChecking}
            className="bg-green-600 hover:bg-green-700"
          >
            {isChecking ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Checking in...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Check In
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
