'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { getBookings, getActivities, cancelBooking, type BookingFilters } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  XCircle,
  CheckCircle,
  ClipboardList,
  Download,
  Loader2,
} from 'lucide-react'
import { format } from 'date-fns'
import type { Booking, Activity } from '@/types'

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [total, setTotal] = useState(0)
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedActivity, setSelectedActivity] = useState<string>('all')
  
  // Cancel dialog
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [bookingToCancel, setBookingToCancel] = useState<Booking | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)

  const fetchBookings = useCallback(async () => {
    setIsLoading(true)
    
    const filters: BookingFilters = { limit: 100 }
    
    if (selectedStatus && selectedStatus !== 'all') {
      filters.status = selectedStatus
    }
    if (selectedActivity && selectedActivity !== 'all') {
      filters.activity_id = selectedActivity
    }
    
    const result = await getBookings(filters)
    
    if (result.success && result.data) {
      let filtered = result.data.bookings
      
      // Client-side search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        filtered = filtered.filter(
          (b) =>
            b.participant?.user?.first_name?.toLowerCase().includes(query) ||
            b.participant?.user?.last_name?.toLowerCase().includes(query) ||
            b.participant?.user?.email?.toLowerCase().includes(query) ||
            b.activity?.title?.toLowerCase().includes(query)
        )
      }
      
      setBookings(filtered)
      setTotal(result.data.pagination.total || 0)
    }
    
    setIsLoading(false)
  }, [selectedStatus, selectedActivity, searchQuery])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  useEffect(() => {
    async function fetchActivities() {
      const result = await getActivities({ limit: 100, include_past: true })
      if (result.success && result.data) {
        setActivities(result.data.activities)
      }
    }
    fetchActivities()
  }, [])

  const handleCancelBooking = async () => {
    if (!bookingToCancel) return
    
    setIsCancelling(true)
    
    const result = await cancelBooking(bookingToCancel.id)
    
    if (result.success) {
      setCancelDialogOpen(false)
      setBookingToCancel(null)
      fetchBookings()
    }
    
    setIsCancelling(false)
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'default'
      case 'cancelled':
        return 'destructive'
      case 'completed':
        return 'secondary'
      case 'no_show':
        return 'outline'
      default:
        return 'secondary'
    }
  }

  const exportToCSV = () => {
    const headers = ['Participant', 'Email', 'Activity', 'Date', 'Status', 'Registered At']
    const rows = bookings.map((b) => [
      `${b.participant?.user?.first_name} ${b.participant?.user?.last_name}`,
      b.participant?.user?.email || '',
      b.activity?.title || '',
      b.activity?.start_datetime ? format(new Date(b.activity.start_datetime), 'yyyy-MM-dd HH:mm') : '',
      b.status,
      format(new Date(b.created_at), 'yyyy-MM-dd HH:mm'),
    ])
    
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bookings-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Bookings
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            View and manage participant registrations
          </p>
        </div>
        <Button variant="outline" onClick={exportToCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by participant name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            {/* Status Filter */}
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-full lg:w-[160px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="no_show">No Show</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Activity Filter */}
            <Select value={selectedActivity} onValueChange={setSelectedActivity}>
              <SelectTrigger className="w-full lg:w-[200px]">
                <SelectValue placeholder="All activities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All activities</SelectItem>
                {activities.map((activity) => (
                  <SelectItem key={activity.id} value={activity.id}>
                    {activity.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Showing {bookings.length} bookings
        </p>
      </div>

      {/* Bookings Table */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-48 mb-2" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : bookings.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Participant</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="text-sm bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                            {booking.participant?.user?.first_name?.[0]}
                            {booking.participant?.user?.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-slate-100">
                            {booking.participant?.user?.first_name}{' '}
                            {booking.participant?.user?.last_name}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {booking.participant?.user?.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/activities/${booking.activity_id}`}
                        className="hover:underline font-medium text-slate-900 dark:text-slate-100"
                      >
                        {booking.activity?.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400">
                      {booking.activity?.start_datetime && (
                        <>
                          {format(new Date(booking.activity.start_datetime), 'MMM d, yyyy')}
                          <br />
                          <span className="text-sm">
                            {format(new Date(booking.activity.start_datetime), 'h:mm a')}
                          </span>
                        </>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={getStatusBadgeVariant(booking.status)}>
                          {booking.status}
                        </Badge>
                        {booking.checked_in_at && (
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-500 dark:text-slate-400">
                      {format(new Date(booking.created_at), 'MMM d, h:mm a')}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/bookings/${booking.id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/participants/${booking.participant_id}`}>
                              View Participant
                            </Link>
                          </DropdownMenuItem>
                          {booking.status === 'confirmed' && (
                            <DropdownMenuItem
                              className="text-red-600 dark:text-red-400"
                              onClick={() => {
                                setBookingToCancel(booking)
                                setCancelDialogOpen(true)
                              }}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Cancel Booking
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <ClipboardList className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                No bookings found
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-center">
                Try adjusting your filters or search query.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancel Booking Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this booking? The participant will be notified.
            </DialogDescription>
          </DialogHeader>
          {bookingToCancel && (
            <div className="py-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg space-y-2">
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {bookingToCancel.participant?.user?.first_name}{' '}
                  {bookingToCancel.participant?.user?.last_name}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {bookingToCancel.activity?.title}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Keep Booking
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelBooking}
              disabled={isCancelling}
            >
              {isCancelling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                'Cancel Booking'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
