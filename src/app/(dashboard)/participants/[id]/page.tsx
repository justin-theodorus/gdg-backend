'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { getParticipant, getBookings } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  AlertTriangle,
  CheckCircle,
  User,
  Heart,
  Utensils,
  AlertCircle,
  Activity,
} from 'lucide-react'
import { format } from 'date-fns'
import type { Participant, Booking } from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function ParticipantDetailPage({ params }: PageProps) {
  const { id } = use(params)
  
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true)
      
      const [participantResult, bookingsResult] = await Promise.all([
        getParticipant(id),
        getBookings({ participant_id: id, limit: 50 }),
      ])
      
      if (participantResult.success && participantResult.data) {
        setParticipant(participantResult.data)
      } else {
        setError('Participant not found')
      }
      
      if (bookingsResult.success && bookingsResult.data) {
        setBookings(bookingsResult.data.bookings)
      }
      
      setIsLoading(false)
    }
    
    fetchData()
  }, [id])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    )
  }

  if (error || !participant) {
    return (
      <div className="space-y-6">
        <Link href="/participants">
          <Button variant="ghost">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Participants
          </Button>
        </Link>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error || 'Participant not found'}</AlertDescription>
        </Alert>
      </div>
    )
  }

  const confirmedBookings = bookings.filter((b) => b.status === 'confirmed')
  const completedBookings = bookings.filter((b) => b.status === 'completed')
  const cancelledBookings = bookings.filter((b) => b.status === 'cancelled')
  const attendanceRate = completedBookings.length > 0
    ? Math.round((completedBookings.filter((b) => b.attended).length / completedBookings.length) * 100)
    : 0

  const membershipLabels: Record<string, string> = {
    adhoc: 'Ad-hoc',
    weekly: 'Weekly',
    twice_weekly: 'Twice Weekly',
    '3plus_weekly': '3+ Weekly',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link href="/participants">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xl">
                {participant.user?.first_name?.[0]}
                {participant.user?.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {participant.user?.first_name} {participant.user?.last_name}
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <Badge variant="secondary">
                  {membershipLabels[participant.membership_type] || participant.membership_type}
                </Badge>
                <span className="text-slate-500 dark:text-slate-400">
                  Member since {format(new Date(participant.created_at), 'MMM yyyy')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              {bookings.length}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Total Bookings
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-emerald-600">
              {confirmedBookings.length}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Upcoming
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              {completedBookings.length}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Attended
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              {attendanceRate}%
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Attendance Rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="history">Booking History ({bookings.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Contact Info */}
            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="h-5 w-5 text-slate-500" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {participant.user?.email && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                      <Mail className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Email</p>
                      <p className="text-slate-900 dark:text-slate-100">
                        {participant.user.email}
                      </p>
                    </div>
                  </div>
                )}
                
                {participant.user?.phone && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                      <Phone className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Phone</p>
                      <p className="text-slate-900 dark:text-slate-100">
                        {participant.user.phone}
                      </p>
                    </div>
                  </div>
                )}
                
                {participant.date_of_birth && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                      <Calendar className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Date of Birth</p>
                      <p className="text-slate-900 dark:text-slate-100">
                        {format(new Date(participant.date_of_birth), 'MMMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Emergency Contact */}
            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  Emergency Contact
                </CardTitle>
              </CardHeader>
              <CardContent>
                {participant.emergency_contact_name ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Name</p>
                      <p className="text-slate-900 dark:text-slate-100 font-medium">
                        {participant.emergency_contact_name}
                      </p>
                    </div>
                    {participant.emergency_contact_relationship && (
                      <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Relationship</p>
                        <p className="text-slate-900 dark:text-slate-100">
                          {participant.emergency_contact_relationship}
                        </p>
                      </div>
                    )}
                    {participant.emergency_contact_phone && (
                      <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Phone</p>
                        <p className="text-slate-900 dark:text-slate-100">
                          {participant.emergency_contact_phone}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-500 dark:text-slate-400">
                    No emergency contact on file
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Accessibility Needs */}
            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Heart className="h-5 w-5 text-rose-500" />
                  Accessibility & Medical
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {participant.accessibility_needs && participant.accessibility_needs.length > 0 ? (
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                      Accessibility Needs
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {participant.accessibility_needs.map((need) => (
                        <Badge key={need} variant="outline" className="border-blue-500 text-blue-600">
                          {need.replace('_', ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-500 dark:text-slate-400">
                    No accessibility needs recorded
                  </p>
                )}
                
                {participant.medical_notes && (
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                      Medical Notes
                    </p>
                    <p className="text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg">
                      {participant.medical_notes}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dietary Restrictions */}
            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Utensils className="h-5 w-5 text-orange-500" />
                  Dietary Restrictions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {participant.dietary_restrictions && participant.dietary_restrictions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {participant.dietary_restrictions.map((restriction) => (
                      <Badge key={restriction} variant="secondary">
                        {restriction}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 dark:text-slate-400">
                    No dietary restrictions recorded
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card className="border-slate-200 dark:border-slate-800">
            <CardContent className="p-0">
              {bookings.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Activity</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Attended</TableHead>
                      <TableHead>Feedback</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.map((booking) => (
                      <TableRow key={booking.id}>
                        <TableCell>
                          <Link
                            href={`/activities/${booking.activity_id}`}
                            className="hover:underline font-medium text-slate-900 dark:text-slate-100"
                          >
                            {booking.activity?.title}
                          </Link>
                        </TableCell>
                        <TableCell className="text-slate-600 dark:text-slate-400">
                          {booking.activity?.start_datetime &&
                            format(new Date(booking.activity.start_datetime), 'MMM d, yyyy h:mm a')}
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
                          {booking.attended === true ? (
                            <CheckCircle className="h-5 w-5 text-emerald-500" />
                          ) : booking.attended === false ? (
                            <span className="text-red-500">No show</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {booking.feedback_rating ? (
                            <div className="flex items-center gap-1">
                              {[...Array(5)].map((_, i) => (
                                <Activity
                                  key={i}
                                  className={`h-4 w-4 ${
                                    i < booking.feedback_rating!
                                      ? 'text-amber-500 fill-amber-500'
                                      : 'text-slate-300'
                                  }`}
                                />
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-16">
                  <Activity className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-4" />
                  <p className="text-slate-500 dark:text-slate-400">
                    No booking history
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
