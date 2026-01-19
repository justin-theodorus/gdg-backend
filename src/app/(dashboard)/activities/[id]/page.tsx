'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  getActivity,
  getBookings,
  getActivityWaitlist,
  findVolunteersForActivity,
  createVolunteerAssignment,
  cancelActivity,
  cloneActivity,
} from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft,
  Clock,
  MapPin,
  Users,
  UserPlus,
  AlertTriangle,
  Edit,
  XCircle,
  CheckCircle,
  Star,
  Loader2,
  HandHeart,
  ClipboardList,
  Copy,
  ClipboardCheck,
} from 'lucide-react'
import { format, isToday, isBefore, subMinutes, addHours } from 'date-fns'
import { toast } from 'sonner'
import { VolunteerAssignmentPanel } from '@/components/dashboard/volunteer-assignment-panel'
import type { Activity, Booking, WaitlistEntry, VolunteerMatch } from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function ActivityDetailPage({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()
  
  const [activity, setActivity] = useState<Activity | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([])
  const [volunteerMatches, setVolunteerMatches] = useState<VolunteerMatch[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Dialogs
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)
  
  const [volunteerDialogOpen, setVolunteerDialogOpen] = useState(false)
  const [selectedVolunteer, setSelectedVolunteer] = useState<VolunteerMatch | null>(null)
  const [assignRole, setAssignRole] = useState('assistant')
  const [assignResponsibilities, setAssignResponsibilities] = useState('')
  const [isAssigning, setIsAssigning] = useState(false)
  const [loadingVolunteers, setLoadingVolunteers] = useState(false)
  const [isCloning, setIsCloning] = useState(false)

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true)
      
      const [activityResult, bookingsResult, waitlistResult] = await Promise.all([
        getActivity(id),
        getBookings({ activity_id: id }),
        getActivityWaitlist(id),
      ])
      
      if (activityResult.success && activityResult.data) {
        setActivity(activityResult.data)
      } else {
        setError('Activity not found')
      }
      
      if (bookingsResult.success && bookingsResult.data) {
        setBookings(bookingsResult.data.bookings)
      }
      
      if (waitlistResult.success && waitlistResult.data) {
        setWaitlist(waitlistResult.data.entries)
      }
      
      setIsLoading(false)
    }
    
    fetchData()
  }, [id])

  const handleFindVolunteers = async () => {
    setLoadingVolunteers(true)
    setVolunteerDialogOpen(true)
    
    const result = await findVolunteersForActivity(id, 10)
    
    if (result.success && result.data) {
      setVolunteerMatches(result.data.matches)
    }
    
    setLoadingVolunteers(false)
  }

  const handleAssignVolunteer = async () => {
    if (!selectedVolunteer) return
    
    setIsAssigning(true)
    
    const result = await createVolunteerAssignment(
      id,
      selectedVolunteer.volunteer.id,
      assignRole,
      assignResponsibilities || undefined
    )
    
    if (result.success) {
      setVolunteerDialogOpen(false)
      setSelectedVolunteer(null)
      setAssignRole('assistant')
      setAssignResponsibilities('')
      // Refresh activity
      const activityResult = await getActivity(id)
      if (activityResult.success && activityResult.data) {
        setActivity(activityResult.data)
      }
    } else {
      setError(result.error?.message || 'Failed to assign volunteer')
    }
    
    setIsAssigning(false)
  }

  const handleCancelActivity = async () => {
    if (!cancelReason.trim()) return
    
    setIsCancelling(true)
    
    const result = await cancelActivity(id, cancelReason)
    
    if (result.success) {
      router.push('/activities')
    } else {
      setError(result.error?.message || 'Failed to cancel activity')
      setCancelDialogOpen(false)
    }
    
    setIsCancelling(false)
  }

  const handleCloneActivity = async () => {
    setIsCloning(true)
    
    const result = await cloneActivity(id)
    
    if (result.success && result.data) {
      toast.success('Activity cloned successfully')
      router.push(`/activities/${result.data.activity.id}/edit`)
    } else {
      toast.error(result.error?.message || 'Failed to clone activity')
    }
    
    setIsCloning(false)
  }

  // Check if check-in is available (activity is today and within time window)
  const canCheckIn = activity && (() => {
    const now = new Date()
    const activityStart = new Date(activity.start_datetime)
    const activityEnd = new Date(activity.end_datetime)
    const earliestCheckIn = subMinutes(activityStart, 30)
    const latestCheckIn = addHours(activityStart, 2)
    return now >= earliestCheckIn && now <= latestCheckIn && !activity.is_cancelled
  })()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <Skeleton className="h-[400px] w-full" />
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
  const availableSpots = activity.capacity - activity.current_bookings
  const fillRate = Math.round((activity.current_bookings / activity.capacity) * 100)
  const isUnderstaffed = activity.current_volunteers < activity.min_volunteers
  const isPast = new Date() > endTime

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link href="/activities">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-2">
              {activity.program && (
                <Badge
                  style={{
                    backgroundColor: `${activity.program.color}20`,
                    color: activity.program.color,
                  }}
                >
                  {activity.program.name}
                </Badge>
              )}
              {activity.is_cancelled && (
                <Badge variant="destructive">Cancelled</Badge>
              )}
              {isUnderstaffed && !activity.is_cancelled && (
                <Badge variant="outline" className="border-amber-500 text-amber-600">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Understaffed
                </Badge>
              )}
              {isPast && !activity.is_cancelled && (
                <Badge variant="secondary">Completed</Badge>
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
        
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {/* Check-in button - shown on activity day */}
          {canCheckIn && (
            <Link href={`/activities/${id}/checkin`}>
              <Button className="bg-green-600 hover:bg-green-700">
                <ClipboardCheck className="h-4 w-4 mr-2" />
                Check-in
              </Button>
            </Link>
          )}
          
          {/* Show check-in button in different state for past/today activities */}
          {!canCheckIn && isToday(new Date(activity.start_datetime)) && !activity.is_cancelled && (
            <Link href={`/activities/${id}/checkin`}>
              <Button variant="outline">
                <ClipboardCheck className="h-4 w-4 mr-2" />
                View Check-ins
              </Button>
            </Link>
          )}
          
          {!activity.is_cancelled && !isPast && (
            <>
              <Button variant="outline" onClick={handleFindVolunteers}>
                <UserPlus className="h-4 w-4 mr-2" />
                Find Volunteers
              </Button>
              <Link href={`/activities/${id}/edit`}>
                <Button variant="outline">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </Link>
            </>
          )}
          
          {/* Clone button - always available */}
          <Button 
            variant="outline" 
            onClick={handleCloneActivity}
            disabled={isCloning}
          >
            {isCloning ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Copy className="h-4 w-4 mr-2" />
            )}
            Clone
          </Button>
          
          {!activity.is_cancelled && !isPast && (
            <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive">
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cancel Activity</DialogTitle>
                  <DialogDescription>
                    This will cancel the activity and notify all registered participants.
                    This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Cancellation Reason *</Label>
                    <Textarea
                      placeholder="Explain why this activity is being cancelled..."
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
                    Keep Activity
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleCancelActivity}
                    disabled={!cancelReason.trim() || isCancelling}
                  >
                    {isCancelling ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Cancelling...
                      </>
                    ) : (
                      'Cancel Activity'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Registrations</p>
                <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {activity.current_bookings} / {activity.capacity}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Fill Rate</p>
                <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {fillRate}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isUnderstaffed ? 'bg-amber-100 dark:bg-amber-950' : 'bg-purple-100 dark:bg-purple-950'}`}>
                <HandHeart className={`h-5 w-5 ${isUnderstaffed ? 'text-amber-600' : 'text-purple-600'}`} />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Volunteers</p>
                <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {activity.current_volunteers} / {activity.min_volunteers}-{activity.max_volunteers}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-950">
                <ClipboardList className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Waitlist</p>
                <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {waitlist.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Content */}
      <Tabs defaultValue="details" className="space-y-6">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="registrations">
            Registrations ({bookings.length})
          </TabsTrigger>
          <TabsTrigger value="volunteers">
            Volunteers ({activity.current_volunteers})
          </TabsTrigger>
          <TabsTrigger value="waitlist">
            Waitlist ({waitlist.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle className="text-lg">Activity Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {activity.description && (
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                      Description
                    </p>
                    <p className="text-slate-900 dark:text-slate-100">
                      {activity.description}
                    </p>
                  </div>
                )}
                
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                      Date & Time
                    </p>
                    <p className="text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {format(startTime, 'MMM d, yyyy')}
                      <span className="text-slate-500">·</span>
                      {format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}
                    </p>
                  </div>
                  
                  {activity.location && (
                    <div>
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                        Location
                      </p>
                      <p className="text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {activity.location}
                        {activity.room && ` · ${activity.room}`}
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="grid gap-4 sm:grid-cols-2">
                  {activity.activity_type && (
                    <div>
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                        Activity Type
                      </p>
                      <Badge variant="secondary" className="capitalize">
                        {activity.activity_type}
                      </Badge>
                    </div>
                  )}
                  
                  {activity.intensity_level && (
                    <div>
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                        Intensity
                      </p>
                      <Badge
                        variant="outline"
                        className={
                          activity.intensity_level === 'low'
                            ? 'border-green-500 text-green-600'
                            : activity.intensity_level === 'moderate'
                            ? 'border-amber-500 text-amber-600'
                            : 'border-red-500 text-red-600'
                        }
                      >
                        {activity.intensity_level}
                      </Badge>
                    </div>
                  )}
                </div>
                
                {activity.requirements && (
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                      Requirements
                    </p>
                    <p className="text-slate-900 dark:text-slate-100">
                      {activity.requirements}
                    </p>
                  </div>
                )}
                
                {activity.tags && activity.tags.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
                      Tags
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {activity.tags.map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle className="text-lg">Capacity & Availability</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">
                      Participants
                    </span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {activity.current_bookings} / {activity.capacity}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        fillRate >= 90
                          ? 'bg-red-500'
                          : fillRate >= 70
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(fillRate, 100)}%` }}
                    />
                  </div>
                </div>
                
                <div className="pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      Available Spots
                    </span>
                    <span className={`font-semibold ${availableSpots === 0 ? 'text-red-600' : 'text-slate-900 dark:text-slate-100'}`}>
                      {availableSpots}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      On Waitlist
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {waitlist.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      Volunteers Needed
                    </span>
                    <span className={`font-semibold ${isUnderstaffed ? 'text-amber-600' : 'text-slate-900 dark:text-slate-100'}`}>
                      {activity.min_volunteers - activity.current_volunteers > 0
                        ? activity.min_volunteers - activity.current_volunteers
                        : 0}{' '}
                      more
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="registrations">
          <Card className="border-slate-200 dark:border-slate-800">
            <CardContent className="p-0">
              {bookings.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Participant</TableHead>
                      <TableHead>Registered</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Checked In</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.map((booking) => (
                      <TableRow key={booking.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
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
                        <TableCell className="text-slate-500 dark:text-slate-400">
                          {format(new Date(booking.created_at), 'MMM d, h:mm a')}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              booking.status === 'confirmed'
                                ? 'default'
                                : booking.status === 'cancelled'
                                ? 'destructive'
                                : 'secondary'
                            }
                          >
                            {booking.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {booking.checked_in_at ? (
                            <span className="flex items-center gap-1 text-emerald-600">
                              <CheckCircle className="h-4 w-4" />
                              {format(new Date(booking.checked_in_at), 'h:mm a')}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <Users className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-4" />
                  <p className="text-slate-500 dark:text-slate-400">
                    No registrations yet
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="volunteers">
          <VolunteerAssignmentPanel
            activityId={id}
            isPast={isPast}
            onFindVolunteers={handleFindVolunteers}
          />
        </TabsContent>

        <TabsContent value="waitlist">
          <Card className="border-slate-200 dark:border-slate-800">
            <CardContent className="p-0">
              {waitlist.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Position</TableHead>
                      <TableHead>Participant</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {waitlist.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <span className="font-bold text-lg text-slate-900 dark:text-slate-100">
                            #{entry.position}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {entry.participant?.user?.first_name?.[0]}
                                {entry.participant?.user?.last_name?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-slate-900 dark:text-slate-100">
                                {entry.participant?.user?.first_name}{' '}
                                {entry.participant?.user?.last_name}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-500 dark:text-slate-400">
                          {format(new Date(entry.created_at), 'MMM d, h:mm a')}
                        </TableCell>
                        <TableCell>
                          <Badge variant={entry.status === 'notified' ? 'default' : 'secondary'}>
                            {entry.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <ClipboardList className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-4" />
                  <p className="text-slate-500 dark:text-slate-400">
                    No one on waitlist
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Find Volunteers Dialog */}
      <Dialog open={volunteerDialogOpen} onOpenChange={setVolunteerDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Find Volunteers</DialogTitle>
            <DialogDescription>
              Top matching volunteers based on interests, availability, and experience
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-[400px] overflow-y-auto">
            {loadingVolunteers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : volunteerMatches.length > 0 ? (
              <div className="space-y-3">
                {volunteerMatches.map((match) => (
                  <div
                    key={match.volunteer.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedVolunteer?.volunteer.id === match.volunteer.id
                        ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                    onClick={() => setSelectedVolunteer(match)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-600 text-white">
                            {match.volunteer.user?.first_name?.[0]}
                            {match.volunteer.user?.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-slate-100">
                            {match.volunteer.user?.first_name} {match.volunteer.user?.last_name}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                            <Star className="h-3.5 w-3.5 text-amber-500" />
                            {match.volunteer.rating.toFixed(1)}
                            <span className="mx-1">·</span>
                            {match.volunteer.total_hours} hours
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-rose-600">
                          {match.score}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          match score
                        </p>
                      </div>
                    </div>
                    
                    {/* Score Breakdown */}
                    <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                      <div className="text-center p-2 rounded bg-slate-100 dark:bg-slate-800">
                        <p className="text-slate-500 dark:text-slate-400">Interest</p>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {match.breakdown.interest_score}
                        </p>
                      </div>
                      <div className="text-center p-2 rounded bg-slate-100 dark:bg-slate-800">
                        <p className="text-slate-500 dark:text-slate-400">Rating</p>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {match.breakdown.rating_score}
                        </p>
                      </div>
                      <div className="text-center p-2 rounded bg-slate-100 dark:bg-slate-800">
                        <p className="text-slate-500 dark:text-slate-400">Experience</p>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {match.breakdown.experience_score}
                        </p>
                      </div>
                      <div className="text-center p-2 rounded bg-slate-100 dark:bg-slate-800">
                        <p className="text-slate-500 dark:text-slate-400">Availability</p>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {match.breakdown.availability_score}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                No matching volunteers found
              </div>
            )}
          </div>
          
          {selectedVolunteer && (
            <div className="border-t pt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={assignRole} onValueChange={setAssignRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="facilitator">Facilitator</SelectItem>
                      <SelectItem value="assistant">Assistant</SelectItem>
                      <SelectItem value="setup_crew">Setup Crew</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Responsibilities (optional)</Label>
                  <Input
                    placeholder="e.g., Help with equipment setup"
                    value={assignResponsibilities}
                    onChange={(e) => setAssignResponsibilities(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setVolunteerDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAssignVolunteer}
              disabled={!selectedVolunteer || isAssigning}
            >
              {isAssigning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Assign Volunteer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
