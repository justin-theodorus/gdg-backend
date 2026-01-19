'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Calendar, dateFnsLocalizer, View, Views } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { getActivities, updateActivity } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  List,
  Clock,
  MapPin,
  Users,
  AlertTriangle,
} from 'lucide-react'
import type { Activity } from '@/types'

import 'react-big-calendar/lib/css/react-big-calendar.css'

const locales = { 'en-US': enUS }

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
})

interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  resource: Activity
}

export default function CalendarPage() {
  const router = useRouter()
  const [activities, setActivities] = useState<Activity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<View>(Views.WEEK)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)

  const fetchActivities = useCallback(async () => {
    setIsLoading(true)
    
    // Get activities for current month range (with buffer)
    const start = startOfMonth(subMonths(currentDate, 1))
    const end = endOfMonth(addMonths(currentDate, 1))
    
    const result = await getActivities({
      start_date: start.toISOString(),
      end_date: end.toISOString(),
      include_past: true,
      limit: 200,
    })
    
    if (result.success && result.data) {
      setActivities(result.data.activities)
    }
    
    setIsLoading(false)
  }, [currentDate])

  useEffect(() => {
    fetchActivities()
  }, [fetchActivities])

  const events: CalendarEvent[] = useMemo(() => {
    return activities.map((activity) => ({
      id: activity.id,
      title: activity.title,
      start: new Date(activity.start_datetime),
      end: new Date(activity.end_datetime),
      resource: activity,
    }))
  }, [activities])

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedEvent(event)
  }

  const handleNavigate = (newDate: Date) => {
    setCurrentDate(newDate)
  }

  const handleViewChange = (newView: View) => {
    setView(newView)
  }

  const handleEventDrop = async ({ event, start, end }: { event: CalendarEvent; start: Date; end: Date }) => {
    const result = await updateActivity(event.id, {
      start_datetime: start.toISOString(),
      end_datetime: end.toISOString(),
    })
    
    if (result.success) {
      fetchActivities()
    }
  }

  const eventStyleGetter = (event: CalendarEvent) => {
    const color = event.resource.program?.color || '#f43f5e'
    const isCancelled = event.resource.is_cancelled
    const isUnderstaffed = event.resource.current_volunteers < event.resource.min_volunteers
    
    return {
      style: {
        backgroundColor: isCancelled ? '#94a3b8' : color,
        borderRadius: '6px',
        opacity: isCancelled ? 0.5 : 1,
        color: 'white',
        border: isUnderstaffed ? '2px solid #f59e0b' : 'none',
        fontSize: '12px',
        fontWeight: 500,
      },
    }
  }

  const CustomToolbar = ({ onNavigate, onView, label, view }: any) => (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onNavigate('PREV')}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          onClick={() => onNavigate('TODAY')}
        >
          Today
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onNavigate('NEXT')}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 ml-2">
          {label}
        </h2>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex border border-slate-200 dark:border-slate-800 rounded-lg p-1">
          <Button
            variant={view === 'month' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onView('month')}
          >
            Month
          </Button>
          <Button
            variant={view === 'week' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onView('week')}
          >
            Week
          </Button>
          <Button
            variant={view === 'day' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onView('day')}
          >
            Day
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Activity Calendar
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            View and manage activity schedule
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/activities">
            <Button variant="outline">
              <List className="h-4 w-4 mr-2" />
              List View
            </Button>
          </Link>
          <Link href="/activities/new">
            <Button className="bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700">
              <Plus className="h-4 w-4 mr-2" />
              New Activity
            </Button>
          </Link>
        </div>
      </div>

      {/* Calendar */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="p-4">
          <style jsx global>{`
            .rbc-calendar {
              font-family: inherit;
            }
            .rbc-header {
              padding: 12px 8px;
              font-weight: 600;
              font-size: 13px;
              color: #64748b;
              background: #f8fafc;
              border-bottom: 1px solid #e2e8f0;
            }
            .dark .rbc-header {
              background: #1e293b;
              color: #94a3b8;
              border-bottom: 1px solid #334155;
            }
            .rbc-time-header-content {
              border-left: none;
            }
            .rbc-time-view {
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              overflow: hidden;
            }
            .dark .rbc-time-view {
              border: 1px solid #334155;
            }
            .rbc-month-view {
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              overflow: hidden;
            }
            .dark .rbc-month-view {
              border: 1px solid #334155;
            }
            .rbc-day-bg {
              background: white;
            }
            .dark .rbc-day-bg {
              background: #0f172a;
            }
            .rbc-off-range-bg {
              background: #f8fafc;
            }
            .dark .rbc-off-range-bg {
              background: #1e293b;
            }
            .rbc-today {
              background: #fef2f2 !important;
            }
            .dark .rbc-today {
              background: #1e1b1b !important;
            }
            .rbc-event {
              padding: 4px 8px;
            }
            .rbc-event-content {
              font-size: 12px;
            }
            .rbc-time-slot {
              border-top: 1px solid #f1f5f9;
            }
            .dark .rbc-time-slot {
              border-top: 1px solid #1e293b;
            }
            .rbc-timeslot-group {
              border-bottom: 1px solid #e2e8f0;
            }
            .dark .rbc-timeslot-group {
              border-bottom: 1px solid #334155;
            }
            .rbc-time-gutter .rbc-timeslot-group {
              border-bottom: none;
            }
            .rbc-current-time-indicator {
              background-color: #f43f5e;
              height: 2px;
            }
            .rbc-current-time-indicator::before {
              content: '';
              position: absolute;
              left: -6px;
              top: -4px;
              width: 10px;
              height: 10px;
              border-radius: 50%;
              background-color: #f43f5e;
            }
          `}</style>
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 700 }}
            view={view}
            onView={handleViewChange}
            date={currentDate}
            onNavigate={handleNavigate}
            onSelectEvent={handleSelectEvent}
            eventPropGetter={eventStyleGetter}
            components={{
              toolbar: CustomToolbar,
            }}
            popup
            selectable
          />
        </CardContent>
      </Card>

      {/* Event Detail Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedEvent?.resource.program && (
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: selectedEvent.resource.program.color }}
                />
              )}
              {selectedEvent?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              {selectedEvent.resource.is_cancelled && (
                <Badge variant="destructive">Cancelled</Badge>
              )}
              {selectedEvent.resource.current_volunteers < selectedEvent.resource.min_volunteers && (
                <Badge variant="outline" className="border-amber-500 text-amber-600">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Needs volunteers
                </Badge>
              )}
              
              <div className="space-y-2 text-sm">
                <p className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <Clock className="h-4 w-4" />
                  {format(selectedEvent.start, 'EEEE, MMMM d, yyyy')}
                  <span className="mx-1">·</span>
                  {format(selectedEvent.start, 'h:mm a')} - {format(selectedEvent.end, 'h:mm a')}
                </p>
                {selectedEvent.resource.location && (
                  <p className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <MapPin className="h-4 w-4" />
                    {selectedEvent.resource.location}
                    {selectedEvent.resource.room && ` · ${selectedEvent.resource.room}`}
                  </p>
                )}
                <p className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <Users className="h-4 w-4" />
                  {selectedEvent.resource.current_bookings} / {selectedEvent.resource.capacity} registered
                </p>
              </div>
              
              {selectedEvent.resource.description && (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {selectedEvent.resource.description}
                </p>
              )}
              
              <div className="flex gap-2 pt-4">
                <Link href={`/activities/${selectedEvent.id}`} className="flex-1">
                  <Button className="w-full">View Details</Button>
                </Link>
                <Button variant="outline" onClick={() => setSelectedEvent(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
