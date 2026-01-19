'use client'

import { useEffect, useState } from 'react'
import { getActivityAssignments, remindVolunteer, type ActivityAssignmentsResponse } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { StarRating } from '@/components/ui/star-rating'
import { VolunteerRatingDialog } from './volunteer-rating-dialog'
import {
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Bell,
  Star,
  Loader2,
  UserPlus,
  Mail,
} from 'lucide-react'
import { format } from 'date-fns'
import type { VolunteerAssignment } from '@/types'
import { toast } from 'sonner'

interface VolunteerAssignmentPanelProps {
  activityId: string
  isPast: boolean
  onFindVolunteers: () => void
}

export function VolunteerAssignmentPanel({
  activityId,
  isPast,
  onFindVolunteers,
}: VolunteerAssignmentPanelProps) {
  const [data, setData] = useState<ActivityAssignmentsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [remindingId, setRemindingId] = useState<string | null>(null)
  const [ratingAssignment, setRatingAssignment] = useState<VolunteerAssignment | null>(null)

  const fetchAssignments = async () => {
    setIsLoading(true)
    const result = await getActivityAssignments(activityId)
    if (result.success && result.data) {
      setData(result.data)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    fetchAssignments()
  }, [activityId])

  const handleRemind = async (assignmentId: string) => {
    setRemindingId(assignmentId)
    const result = await remindVolunteer(assignmentId)
    if (result.success) {
      toast.success('Reminder sent successfully')
    } else {
      toast.error(result.error?.message || 'Failed to send reminder')
    }
    setRemindingId(null)
  }

  const handleRatingComplete = () => {
    setRatingAssignment(null)
    fetchAssignments() // Refresh the list
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-8 text-slate-500">
        Failed to load volunteer assignments
      </div>
    )
  }

  const { grouped, stats, activity } = data

  const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    invited: { label: 'Pending', icon: Clock, color: 'text-amber-600 bg-amber-50' },
    confirmed: { label: 'Confirmed', icon: CheckCircle, color: 'text-blue-600 bg-blue-50' },
    completed: { label: 'Completed', icon: Star, color: 'text-green-600 bg-green-50' },
    declined: { label: 'Declined', icon: XCircle, color: 'text-red-600 bg-red-50' },
    cancelled: { label: 'Cancelled', icon: XCircle, color: 'text-slate-600 bg-slate-50' },
  }

  const renderAssignment = (assignment: VolunteerAssignment, status: string) => {
    const config = statusConfig[status]
    const Icon = config.icon
    const volunteer = assignment.volunteer as any
    const canRate = isPast && status === 'confirmed' && !assignment.staff_rating

    return (
      <div
        key={assignment.id}
        className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-800"
      >
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-600 text-white text-sm">
              {volunteer?.user?.first_name?.[0]}
              {volunteer?.user?.last_name?.[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-slate-900 dark:text-slate-100">
              {volunteer?.user?.first_name} {volunteer?.user?.last_name}
            </p>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Badge variant="outline" className="text-xs capitalize">
                {assignment.role}
              </Badge>
              {volunteer?.rating > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                  {parseFloat(volunteer.rating).toFixed(1)}
                </span>
              )}
              <span>{volunteer?.total_hours || 0}h total</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status === 'invited' && (
            <>
              <span className="text-xs text-slate-500">
                Invited {format(new Date(assignment.created_at), 'MMM d')}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRemind(assignment.id)}
                disabled={remindingId === assignment.id}
              >
                {remindingId === assignment.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Bell className="h-4 w-4 mr-1" />
                    Remind
                  </>
                )}
              </Button>
            </>
          )}

          {status === 'confirmed' && !isPast && (
            <span className="text-xs text-slate-500">
              Confirmed {assignment.responded_at && format(new Date(assignment.responded_at), 'MMM d')}
            </span>
          )}

          {status === 'completed' && assignment.staff_rating && (
            <div className="flex items-center gap-2">
              <StarRating value={assignment.staff_rating} readonly size="sm" />
              <span className="text-xs text-slate-500">
                {assignment.hours_contributed}h
              </span>
            </div>
          )}

          {canRate && (
            <Button
              size="sm"
              onClick={() => setRatingAssignment(assignment)}
            >
              <Star className="h-4 w-4 mr-1" />
              Rate
            </Button>
          )}

          {status === 'declined' && (
            <span className="text-xs text-slate-500">
              Declined {assignment.responded_at && format(new Date(assignment.responded_at), 'MMM d')}
            </span>
          )}
        </div>
      </div>
    )
  }

  const renderSection = (
    title: string,
    assignments: VolunteerAssignment[],
    status: string,
    collapsed = false
  ) => {
    if (assignments.length === 0) return null

    const config = statusConfig[status]
    const Icon = config.icon

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-full ${config.color}`}>
            <Icon className="h-4 w-4" />
          </div>
          <span className="font-medium text-slate-900 dark:text-slate-100">
            {title}
          </span>
          <Badge variant="secondary">{assignments.length}</Badge>
        </div>
        <div className="space-y-2">
          {assignments.map(a => renderAssignment(a, status))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {stats.confirmed + stats.completed}
            </p>
            <p className="text-sm text-slate-500">Active</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">
              {stats.invited}
            </p>
            <p className="text-sm text-slate-500">Pending</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4 text-center">
            <p className={`text-2xl font-bold ${stats.is_understaffed ? 'text-red-600' : 'text-green-600'}`}>
              {stats.needed}
            </p>
            <p className="text-sm text-slate-500">Still Needed</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">
              {activity.min_volunteers}-{activity.max_volunteers}
            </p>
            <p className="text-sm text-slate-500">Target Range</p>
          </CardContent>
        </Card>
      </div>

      {/* Understaffed Warning */}
      {stats.is_understaffed && !isPast && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  This activity needs {stats.needed} more volunteer(s)
                </p>
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Current: {activity.current_volunteers} / Minimum: {activity.min_volunteers}
                </p>
              </div>
            </div>
            <Button onClick={onFindVolunteers}>
              <UserPlus className="h-4 w-4 mr-2" />
              Find Volunteers
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Assignment Sections */}
      <div className="space-y-6">
        {renderSection('Pending Invitations', grouped.invited, 'invited')}
        {renderSection('Confirmed Volunteers', grouped.confirmed, 'confirmed')}
        {renderSection('Completed', grouped.completed, 'completed')}
        {renderSection('Declined', grouped.declined, 'declined', true)}
        {renderSection('Cancelled', grouped.cancelled, 'cancelled', true)}
      </div>

      {/* Empty State */}
      {stats.total === 0 && (
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="py-12 text-center">
            <UserPlus className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-700 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
              No volunteers assigned
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              Find and assign volunteers to help with this activity.
            </p>
            {!isPast && (
              <Button onClick={onFindVolunteers}>
                <UserPlus className="h-4 w-4 mr-2" />
                Find Volunteers
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      {!isPast && stats.total > 0 && activity.current_volunteers < activity.max_volunteers && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={onFindVolunteers}>
            <UserPlus className="h-4 w-4 mr-2" />
            Assign More Volunteers
          </Button>
        </div>
      )}

      {/* Rating Dialog */}
      {ratingAssignment && (
        <VolunteerRatingDialog
          assignment={ratingAssignment}
          open={!!ratingAssignment}
          onOpenChange={(open) => !open && setRatingAssignment(null)}
          onComplete={handleRatingComplete}
        />
      )}
    </div>
  )
}
