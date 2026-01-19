'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { getActivity, updateActivity, getPrograms } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CalendarDays,
  MapPin,
  Users,
  Tag,
  AlertTriangle,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import type { Program, Activity } from '@/types'

const activitySchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().optional(),
  program_id: z.string().optional(),
  start_datetime: z.string().min(1, 'Start date/time is required'),
  end_datetime: z.string().min(1, 'End date/time is required'),
  location: z.string().optional(),
  room: z.string().optional(),
  capacity: z.string().refine((val) => parseInt(val, 10) >= 1, 'Capacity must be at least 1'),
  activity_type: z.string().optional(),
  intensity_level: z.enum(['low', 'moderate', 'high']).optional(),
  min_volunteers: z.string().refine((val) => parseInt(val, 10) >= 0, 'Cannot be negative'),
  max_volunteers: z.string().refine((val) => parseInt(val, 10) >= 0, 'Cannot be negative'),
  requirements: z.string().optional(),
  tags: z.string().optional(),
})

type ActivityFormData = z.infer<typeof activitySchema>

interface PageProps {
  params: Promise<{ id: string }>
}

export default function EditActivityPage({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()
  const [activity, setActivity] = useState<Activity | null>(null)
  const [programs, setPrograms] = useState<Program[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showTimeWarning, setShowTimeWarning] = useState(false)
  const [pendingData, setPendingData] = useState<ActivityFormData | null>(null)

  const form = useForm<ActivityFormData>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      title: '',
      description: '',
      program_id: '',
      start_datetime: '',
      end_datetime: '',
      location: '',
      room: '',
      capacity: '20',
      activity_type: '',
      intensity_level: undefined,
      min_volunteers: '1',
      max_volunteers: '3',
      requirements: '',
      tags: '',
    },
  })

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true)

      const [activityResult, programsResult] = await Promise.all([
        getActivity(id),
        getPrograms(),
      ])

      if (activityResult.success && activityResult.data) {
        const a = activityResult.data
        setActivity(a)

        // Populate form with existing values
        form.reset({
          title: a.title || '',
          description: a.description || '',
          program_id: a.program_id || '',
          start_datetime: a.start_datetime ? format(parseISO(a.start_datetime), "yyyy-MM-dd'T'HH:mm") : '',
          end_datetime: a.end_datetime ? format(parseISO(a.end_datetime), "yyyy-MM-dd'T'HH:mm") : '',
          location: a.location || '',
          room: a.room || '',
          capacity: String(a.capacity || 20),
          activity_type: a.activity_type || '',
          intensity_level: a.intensity_level || undefined,
          min_volunteers: String(a.min_volunteers || 0),
          max_volunteers: String(a.max_volunteers || 5),
          requirements: a.requirements || '',
          tags: Array.isArray(a.tags) ? a.tags.join(', ') : '',
        })
      } else {
        setError('Activity not found')
      }

      if (programsResult.success && programsResult.data) {
        setPrograms(programsResult.data.programs || [])
      }

      setIsLoading(false)
    }
    fetchData()
  }, [id, form])

  const checkTimeChanged = (data: ActivityFormData): boolean => {
    if (!activity) return false
    const originalStart = format(parseISO(activity.start_datetime), "yyyy-MM-dd'T'HH:mm")
    const originalEnd = format(parseISO(activity.end_datetime), "yyyy-MM-dd'T'HH:mm")
    return data.start_datetime !== originalStart || data.end_datetime !== originalEnd
  }

  const onSubmit = async (data: ActivityFormData) => {
    if (!activity) return

    // Check if capacity is being reduced below current bookings
    const newCapacity = parseInt(data.capacity, 10)
    if (newCapacity < activity.current_bookings) {
      setError(`Cannot reduce capacity below current bookings (${activity.current_bookings})`)
      return
    }

    // Check if time changed - show warning
    if (checkTimeChanged(data) && !pendingData) {
      setPendingData(data)
      setShowTimeWarning(true)
      return
    }

    await submitUpdate(data)
  }

  const submitUpdate = async (data: ActivityFormData) => {
    setIsSubmitting(true)
    setError(null)

    // Convert tags string to array
    const tags = data.tags
      ? data.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : []

    const updateData = {
      title: data.title,
      description: data.description || null,
      program_id: data.program_id || null,
      start_datetime: data.start_datetime,
      end_datetime: data.end_datetime,
      location: data.location || null,
      room: data.room || null,
      capacity: parseInt(data.capacity, 10),
      activity_type: data.activity_type || null,
      intensity_level: data.intensity_level || null,
      min_volunteers: parseInt(data.min_volunteers, 10),
      max_volunteers: parseInt(data.max_volunteers, 10),
      requirements: data.requirements || null,
      tags,
    }

    const result = await updateActivity(id, updateData)

    if (result.success) {
      router.push(`/activities/${id}`)
    } else {
      setError(result.error?.message || 'Failed to update activity')
      setIsSubmitting(false)
    }
  }

  const handleConfirmTimeChange = () => {
    if (pendingData) {
      setShowTimeWarning(false)
      submitUpdate(pendingData)
      setPendingData(null)
    }
  }

  const activityTypes = [
    { value: 'exercise', label: 'Exercise' },
    { value: 'arts', label: 'Arts & Crafts' },
    { value: 'social', label: 'Social' },
    { value: 'educational', label: 'Educational' },
    { value: 'therapy', label: 'Therapy' },
    { value: 'recreation', label: 'Recreation' },
  ]

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Skeleton className="h-[600px]" />
      </div>
    )
  }

  if (error && !activity) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Link href="/activities">
          <Button variant="ghost">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Activities
          </Button>
        </Link>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  // Check if activity is in the past
  const isPast = activity && new Date(activity.start_datetime) < new Date()

  if (isPast) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Link href={`/activities/${id}`}>
          <Button variant="ghost">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Activity
          </Button>
        </Link>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Cannot edit past activities</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/activities/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Edit Activity
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {activity?.title}
          </p>
        </div>
      </div>

      {/* Current bookings warning */}
      {activity && activity.current_bookings > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This activity has <strong>{activity.current_bookings}</strong> registered participants.
            Changes will be reflected in their bookings.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info */}
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarDays className="h-5 w-5 text-slate-500" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Activity Title *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Morning Yoga Session" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe the activity..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="program_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Program</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select program" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {programs.map((program) => (
                            <SelectItem key={program.id} value={program.id}>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: program.color }}
                                />
                                {program.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="activity_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Activity Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {activityTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="intensity_level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Intensity Level</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select intensity" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-green-100 text-green-700">Low</Badge>
                            Gentle, suitable for all
                          </div>
                        </SelectItem>
                        <SelectItem value="moderate">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-amber-100 text-amber-700">Moderate</Badge>
                            Some physical activity
                          </div>
                        </SelectItem>
                        <SelectItem value="high">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-red-100 text-red-700">High</Badge>
                            Physically demanding
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Schedule */}
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-5 w-5 text-slate-500" />
                Schedule & Location
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="start_datetime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date & Time *</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="end_datetime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date & Time *</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Community Center" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="room"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Room</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Room 101" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Capacity */}
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-slate-500" />
                Capacity & Volunteers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Participant Capacity *</FormLabel>
                    <FormControl>
                      <Input type="number" min={activity?.current_bookings || 1} {...field} />
                    </FormControl>
                    <FormDescription>
                      {activity && activity.current_bookings > 0 && (
                        <span className="text-amber-600">
                          Minimum: {activity.current_bookings} (current registrations)
                        </span>
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="min_volunteers"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Volunteers</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} {...field} />
                      </FormControl>
                      <FormDescription>
                        Alert if below this number
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="max_volunteers"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maximum Volunteers</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} {...field} />
                      </FormControl>
                      <FormDescription>
                        Maximum volunteers needed
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Additional Info */}
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Tag className="h-5 w-5 text-slate-500" />
                Additional Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="requirements"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Requirements</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., Wear comfortable clothes, bring water bottle"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      What participants should bring or prepare
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tags</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., sports, outdoor, social (comma-separated)" {...field} />
                    </FormControl>
                    <FormDescription>
                      Used for volunteer matching
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4 justify-end">
            <Link href={`/activities/${id}`}>
              <Button variant="outline" type="button">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </form>
      </Form>

      {/* Time Change Warning Dialog */}
      <Dialog open={showTimeWarning} onOpenChange={setShowTimeWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Time Changed
            </DialogTitle>
            <DialogDescription>
              You are changing the date or time of this activity.
              {activity && activity.current_bookings > 0 && (
                <span className="block mt-2 font-medium text-slate-900 dark:text-slate-100">
                  {activity.current_bookings} registered participant(s) will be notified about this change.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowTimeWarning(false)
                setPendingData(null)
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmTimeChange}>
              Confirm Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
