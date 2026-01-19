'use client'

import { useEffect, useState, use, useMemo } from 'react'
import Link from 'next/link'
import { getActivity, getBookings, checkInBooking, undoCheckIn, bulkCheckIn } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ParticipantCheckInCard } from '@/components/dashboard/participant-checkin-card'
import {
  ArrowLeft,
  Search,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  CheckCheck,
  RotateCcw,
} from 'lucide-react'
import { format, isToday, isBefore, isAfter, addHours, subMinutes } from 'date-fns'
import { toast } from 'sonner'
import type { Activity, Booking } from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function CheckInPage({ params }: PageProps) {
  const { id } = use(params)

  const [activity, setActivity] = useState<Activity | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [checkingId, setCheckingId] = useState<string | null>(null)
  const [isBulkChecking, setIsBulkChecking] = useState(false)

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true)

      const [activityResult, bookingsResult] = await Promise.all([
        getActivity(id),
        getBookings({ activity_id: id, status: 'confirmed' }),
      ])

      if (activityResult.success && activityResult.data) {
        setActivity(activityResult.data)
      } else {
        setError('Activity not found')
      }

      if (bookingsResult.success && bookingsResult.data) {
        setBookings(bookingsResult.data.bookings)
      }

      setIsLoading(false)
    }

    fetchData()
  }, [id])

  // Filter bookings by search
  const filteredBookings = useMemo(() => {
    if (!searchQuery.trim()) return bookings

    const query = searchQuery.toLowerCase()
    return bookings.filter((booking) => {
      const participant = booking.participant as any
      const user = participant?.user
      const fullName = `${user?.first_name || ''} ${user?.last_name || ''}`.toLowerCase()
      return fullName.includes(query)
    })
  }, [bookings, searchQuery])

  // Calculate stats
  const stats = useMemo(() => {
    const checkedIn = bookings.filter(b => b.checked_in_at).length
    const notCheckedIn = bookings.filter(b => !b.checked_in_at).length
    const total = bookings.length
    const attendanceRate = total > 0 ? Math.round((checkedIn / total) * 100) : 0

    return { checkedIn, notCheckedIn, total, attendanceRate }
  }, [bookings])

  // Check if check-in is allowed
  const checkInStatus = useMemo(() => {
    if (!activity) return { allowed: false, reason: 'Loading...' }

    const now = new Date()
    const activityStart = new Date(activity.start_datetime)
    const activityEnd = new Date(activity.end_datetime)
    const earliestCheckIn = subMinutes(activityStart, 30)
    const latestCheckIn = addHours(activityStart, 2)

    if (isBefore(now, earliestCheckIn)) {
      return {
        allowed: false,
        reason: `Check-in opens at ${format(earliestCheckIn, 'h:mm a')}`,
      }
    }

    if (isAfter(now, latestCheckIn)) {
      return {
        allowed: false,
        reason: 'Check-in window has closed',
      }
    }

    return { allowed: true, reason: '' }
  }, [activity])

  const handleCheckIn = async (bookingId: string) => {
    setCheckingId(bookingId)

    const result = await checkInBooking(bookingId)

    if (result.success && result.data) {
      // Update local state
      setBookings(prev =>
        prev.map(b =>
          b.id === bookingId
            ? { ...b, checked_in_at: result.data?.checked_in_at || new Date().toISOString(), attended: true }
            : b
        )
      )
      toast.success(`${result.data.participant.name} checked in`)
    } else {
      toast.error(result.error?.message || 'Failed to check in')
    }

    setCheckingId(null)
  }

  const handleUndoCheckIn = async (bookingId: string) => {
    setCheckingId(bookingId)

    const result = await undoCheckIn(bookingId)

    if (result.success) {
      // Update local state
      setBookings(prev =>
        prev.map(b =>
          b.id === bookingId
            ? { ...b, checked_in_at: null, attended: null }
            : b
        )
      )
      toast.success('Check-in undone')
    } else {
      toast.error(result.error?.message || 'Failed to undo check-in')
    }

    setCheckingId(null)
  }

  const handleBulkCheckIn = async () => {
    const uncheckedBookings = bookings.filter(b => !b.checked_in_at)
    if (uncheckedBookings.length === 0) {
      toast.info('All participants are already checked in')
      return
    }

    setIsBulkChecking(true)

    const result = await bulkCheckIn(uncheckedBookings.map(b => b.id))

    if (result.success && result.data) {
      // Update local state - mark all as checked in
      setBookings(prev =>
        prev.map(b =>
          !b.checked_in_at
            ? { ...b, checked_in_at: new Date().toISOString(), attended: true }
            : b
        )
      )
      toast.success(`Checked in ${result.data.successful} participant(s)`)
    }

    setIsBulkChecking(false)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <Skeleton className="h-24" />
        <Skeleton className="h-[400px]" />
      </div>
    )
  }

  if (error || !activity) {
    return (
      <div className="space-y-6">
        <Link href="/activities">
          <Button variant="ghost">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Activities
          </Button>
        </Link>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error || 'Activity not found'}</AlertDescription>
        </Alert>
      </div>
    )
  }

  const startTime = new Date(activity.start_datetime)
  const endTime = new Date(activity.end_datetime)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link href={`/activities/${id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary">Check-In Mode</Badge>
              {isToday(startTime) && (
                <Badge className="bg-green-100 text-green-700">Today</Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {activity.title}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              {format(startTime, 'EEEE, MMMM d, yyyy')} · {format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}
            </p>
          </div>
        </div>
      </div>

      {/* Check-in Status Alert */}
      {!checkInStatus.allowed && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertDescription>{checkInStatus.reason}</AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Registered</p>
                <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {stats.total}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-950">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Checked In</p>
                <p className="text-xl font-bold text-green-600">
                  {stats.checkedIn}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Pending</p>
                <p className="text-xl font-bold text-amber-600">
                  {stats.notCheckedIn}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950">
                <CheckCheck className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Attendance</p>
                <p className="text-xl font-bold text-purple-600">
                  {stats.attendanceRate}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Bulk Actions */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search participants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Bulk Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleBulkCheckIn}
                disabled={!checkInStatus.allowed || isBulkChecking || stats.notCheckedIn === 0}
              >
                {isBulkChecking ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Checking in...
                  </>
                ) : (
                  <>
                    <CheckCheck className="h-4 w-4 mr-2" />
                    Check In All ({stats.notCheckedIn})
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Participant List */}
      <div className="space-y-3">
        {filteredBookings.length > 0 ? (
          filteredBookings.map((booking) => (
            <ParticipantCheckInCard
              key={booking.id}
              booking={booking}
              isChecking={checkingId === booking.id}
              onCheckIn={() => handleCheckIn(booking.id)}
              onUndoCheckIn={() => handleUndoCheckIn(booking.id)}
            />
          ))
        ) : bookings.length === 0 ? (
          <Card className="border-slate-200 dark:border-slate-800">
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-700 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                No participants registered
              </h3>
              <p className="text-slate-500 dark:text-slate-400">
                There are no confirmed registrations for this activity yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-slate-200 dark:border-slate-800">
            <CardContent className="py-12 text-center">
              <Search className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-700 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                No matches found
              </h3>
              <p className="text-slate-500 dark:text-slate-400">
                No participants match &quot;{searchQuery}&quot;
              </p>
              <Button
                variant="ghost"
                onClick={() => setSearchQuery('')}
                className="mt-4"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Clear search
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Footer Stats */}
      {bookings.length > 0 && (
        <div className="flex items-center justify-center gap-6 py-4 text-sm text-slate-500">
          <span className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            Checked in: {stats.checkedIn}
          </span>
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            Pending: {stats.notCheckedIn}
          </span>
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-500" />
            Total: {stats.total}
          </span>
        </div>
      )}
    </div>
  )
}
