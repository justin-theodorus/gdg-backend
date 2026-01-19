'use client'

import { useState } from 'react'
import { completeVolunteerAssignment } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { StarRating } from '@/components/ui/star-rating'
import { Loader2, Star, Clock } from 'lucide-react'
import { toast } from 'sonner'
import type { VolunteerAssignment } from '@/types'

interface VolunteerRatingDialogProps {
  assignment: VolunteerAssignment
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
}

export function VolunteerRatingDialog({
  assignment,
  open,
  onOpenChange,
  onComplete,
}: VolunteerRatingDialogProps) {
  const [rating, setRating] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [hours, setHours] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const volunteer = assignment.volunteer as any
  const activity = assignment.activity as any

  // Calculate default hours from check-in/out or activity duration
  const getDefaultHours = () => {
    if (assignment.check_in_time && assignment.check_out_time) {
      const checkIn = new Date(assignment.check_in_time)
      const checkOut = new Date(assignment.check_out_time)
      return ((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)).toFixed(1)
    }
    if (activity?.start_datetime && activity?.end_datetime) {
      const start = new Date(activity.start_datetime)
      const end = new Date(activity.end_datetime)
      return ((end.getTime() - start.getTime()) / (1000 * 60 * 60)).toFixed(1)
    }
    return ''
  }

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Please select a rating')
      return
    }

    setIsSubmitting(true)

    const result = await completeVolunteerAssignment(
      assignment.id,
      rating,
      feedback || undefined,
      hours ? parseFloat(hours) : undefined
    )

    if (result.success && result.data) {
      toast.success(
        <div>
          <p className="font-medium">Rating submitted!</p>
          <p className="text-sm text-slate-500">
            {volunteer?.user?.first_name}&apos;s new rating: {result.data.volunteer_new_stats.rating.toFixed(1)}
          </p>
        </div>
      )
      onComplete()
    } else {
      toast.error(result.error?.message || 'Failed to submit rating')
    }

    setIsSubmitting(false)
  }

  const ratingLabels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent']

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rate Volunteer</DialogTitle>
          <DialogDescription>
            Provide feedback for this volunteer&apos;s performance
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Volunteer Info */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-600 text-white">
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
                    {parseFloat(volunteer.rating).toFixed(1)} avg
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Rating */}
          <div className="space-y-3">
            <Label>Performance Rating *</Label>
            <div className="flex flex-col items-center gap-2">
              <StarRating
                value={rating}
                onChange={setRating}
                size="lg"
              />
              {rating > 0 && (
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  {ratingLabels[rating]}
                </span>
              )}
            </div>
          </div>

          {/* Hours */}
          <div className="space-y-2">
            <Label htmlFor="hours">Hours Contributed</Label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="hours"
                type="number"
                step="0.5"
                min="0"
                placeholder={getDefaultHours() || 'Auto-calculated'}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="pl-9"
              />
            </div>
            <p className="text-xs text-slate-500">
              Leave blank to auto-calculate from check-in/out times
            </p>
          </div>

          {/* Feedback */}
          <div className="space-y-2">
            <Label htmlFor="feedback">Feedback (Optional)</Label>
            <Textarea
              id="feedback"
              placeholder="Share specific observations about their work..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={rating === 0 || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Star className="h-4 w-4 mr-2" />
                Submit Rating
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
