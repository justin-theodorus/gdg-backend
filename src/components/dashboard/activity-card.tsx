import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { Clock, MapPin, Users, AlertTriangle, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import type { Activity } from '@/types'

interface ActivityCardProps {
  activity: Activity & { fill_rate?: number }
  compact?: boolean
}

export function ActivityCard({ activity, compact = false }: ActivityCardProps) {
  const startTime = new Date(activity.start_datetime)
  const endTime = new Date(activity.end_datetime)
  const availableSpots = activity.capacity - activity.current_bookings
  const fillRate = activity.fill_rate ?? Math.round((activity.current_bookings / activity.capacity) * 100)
  const isUnderstaffed = activity.current_volunteers < activity.min_volunteers
  const isAlmostFull = fillRate >= 90

  if (compact) {
    return (
      <div className="flex items-center gap-4 p-4 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
        <div
          className="w-2 h-12 rounded-full"
          style={{ backgroundColor: activity.program?.color || '#f43f5e' }}
        />
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-slate-900 dark:text-slate-100 truncate">
            {activity.title}
          </h4>
          <div className="flex items-center gap-3 mt-1 text-sm text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {format(startTime, 'h:mm a')}
            </span>
            {activity.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {activity.location}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isUnderstaffed && (
            <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Needs volunteers
            </Badge>
          )}
          <span className={cn(
            'text-sm font-medium px-2 py-1 rounded-md',
            isAlmostFull 
              ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400' 
              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
          )}>
            {activity.current_bookings}/{activity.capacity}
          </span>
        </div>
      </div>
    )
  }

  return (
    <Card className="border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow overflow-hidden">
      <div
        className="h-1.5"
        style={{ backgroundColor: activity.program?.color || '#f43f5e' }}
      />
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {activity.program && (
                <Badge
                  variant="secondary"
                  className="text-xs font-medium"
                  style={{
                    backgroundColor: `${activity.program.color}20`,
                    color: activity.program.color,
                  }}
                >
                  {activity.program.name}
                </Badge>
              )}
              {isUnderstaffed && (
                <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Understaffed
                </Badge>
              )}
            </div>
            <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100 mb-2">
              {activity.title}
            </h3>
            <div className="space-y-1.5 text-sm text-slate-500 dark:text-slate-400">
              <p className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {format(startTime, 'EEE, MMM d')} · {format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}
              </p>
              {activity.location && (
                <p className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {activity.location}
                  {activity.room && ` · ${activity.room}`}
                </p>
              )}
              <p className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                {activity.current_bookings} registered · {availableSpots} spots left
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {fillRate}%
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                capacity
              </p>
            </div>
            <Link href={`/activities/${activity.id}`}>
              <Button variant="ghost" size="sm">
                View
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
