'use client'

import { useEffect, useState } from 'react'
import { useDashboardStore } from '@/stores/dashboard-store'
import { getActivities } from '@/lib/api-client'
import { MetricCard } from '@/components/dashboard/metric-card'
import { ActivityCard } from '@/components/dashboard/activity-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Users,
  UserCheck,
  HandHeart,
  Star,
  CalendarDays,
  AlertTriangle,
  TrendingUp,
  ChevronRight,
  RefreshCw,
} from 'lucide-react'
import Link from 'next/link'
import { format, startOfToday, endOfToday, addDays } from 'date-fns'
import type { Activity } from '@/types'

export default function DashboardPage() {
  const {
    metrics,
    popularActivities,
    volunteerLeaderboard,
    isLoading,
    error,
    selectedDays,
    setSelectedDays,
    refreshDashboard,
  } = useDashboardStore()

  const [upcomingActivities, setUpcomingActivities] = useState<Activity[]>([])
  const [understaffedActivities, setUnderstaffedActivities] = useState<Activity[]>([])
  const [loadingActivities, setLoadingActivities] = useState(true)

  useEffect(() => {
    refreshDashboard()
  }, [selectedDays, refreshDashboard])

  useEffect(() => {
    async function fetchActivities() {
      setLoadingActivities(true)
      
      // Fetch upcoming activities
      const today = startOfToday()
      const nextWeek = addDays(today, 7)
      
      const result = await getActivities({
        start_date: today.toISOString(),
        end_date: nextWeek.toISOString(),
        limit: 10,
      })

      if (result.success && result.data) {
        setUpcomingActivities(result.data.activities)
        
        // Filter understaffed activities
        const understaffed = result.data.activities.filter(
          (a) => a.current_volunteers < a.min_volunteers
        )
        setUnderstaffedActivities(understaffed)
      }
      
      setLoadingActivities(false)
    }

    fetchActivities()
  }, [])

  const handlePeriodChange = (value: string) => {
    setSelectedDays(parseInt(value))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Dashboard Overview
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Welcome back! Here's what's happening today.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={String(selectedDays)} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => refreshDashboard()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <>
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="border-slate-200 dark:border-slate-800">
                <CardContent className="p-6">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            <MetricCard
              title="Total Registrations"
              value={metrics?.total_registrations ?? 0}
              subtitle="this period"
              icon={TrendingUp}
              iconColor="text-blue-600"
              iconBgColor="bg-blue-100 dark:bg-blue-950/50"
            />
            <MetricCard
              title="Unique Participants"
              value={metrics?.unique_participants ?? 0}
              subtitle="active"
              icon={Users}
              iconColor="text-emerald-600"
              iconBgColor="bg-emerald-100 dark:bg-emerald-950/50"
            />
            <MetricCard
              title="Active Volunteers"
              value={metrics?.active_volunteers ?? 0}
              subtitle="this period"
              icon={HandHeart}
              iconColor="text-purple-600"
              iconBgColor="bg-purple-100 dark:bg-purple-950/50"
            />
            <MetricCard
              title="Satisfaction Rating"
              value={metrics?.average_satisfaction?.toFixed(1) ?? '0.0'}
              subtitle="/ 5.0"
              icon={Star}
              iconColor="text-amber-600"
              iconBgColor="bg-amber-100 dark:bg-amber-950/50"
            />
          </>
        )}
      </div>

      {/* Alerts */}
      {understaffedActivities.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              Activities Needing Volunteers ({understaffedActivities.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {understaffedActivities.slice(0, 3).map((activity) => (
              <ActivityCard key={activity.id} activity={activity} compact />
            ))}
            {understaffedActivities.length > 3 && (
              <Link href="/activities?understaffed=true">
                <Button variant="ghost" className="w-full mt-2 text-amber-700 dark:text-amber-400">
                  View all {understaffedActivities.length} understaffed activities
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Upcoming Activities */}
        <div className="lg:col-span-2">
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-slate-500" />
                Upcoming Activities
              </CardTitle>
              <Link href="/activities">
                <Button variant="ghost" size="sm">
                  View all
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="list" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="list">List</TabsTrigger>
                  <TabsTrigger value="today">Today</TabsTrigger>
                </TabsList>
                <TabsContent value="list" className="space-y-3">
                  {loadingActivities ? (
                    [...Array(3)].map((_, i) => (
                      <div key={i} className="flex items-center gap-4 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                        <Skeleton className="w-2 h-12 rounded-full" />
                        <div className="flex-1">
                          <Skeleton className="h-5 w-48 mb-2" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                        <Skeleton className="h-8 w-16" />
                      </div>
                    ))
                  ) : upcomingActivities.length > 0 ? (
                    upcomingActivities.slice(0, 5).map((activity) => (
                      <ActivityCard key={activity.id} activity={activity} compact />
                    ))
                  ) : (
                    <p className="text-center text-slate-500 dark:text-slate-400 py-8">
                      No upcoming activities scheduled
                    </p>
                  )}
                </TabsContent>
                <TabsContent value="today" className="space-y-3">
                  {loadingActivities ? (
                    <Skeleton className="h-20 w-full" />
                  ) : (
                    upcomingActivities
                      .filter((a) => {
                        const actDate = new Date(a.start_datetime)
                        const today = startOfToday()
                        const tomorrow = endOfToday()
                        return actDate >= today && actDate <= tomorrow
                      })
                      .map((activity) => (
                        <ActivityCard key={activity.id} activity={activity} compact />
                      ))
                  )}
                  {!loadingActivities &&
                    upcomingActivities.filter((a) => {
                      const actDate = new Date(a.start_datetime)
                      return actDate >= startOfToday() && actDate <= endOfToday()
                    }).length === 0 && (
                      <p className="text-center text-slate-500 dark:text-slate-400 py-8">
                        No activities scheduled for today
                      </p>
                    )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Stats */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="text-base">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  Total Activities
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {metrics?.total_activities ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  Upcoming Activities
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {metrics?.upcoming_activities ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  Cancellation Rate
                </span>
                <Badge variant={metrics?.cancellation_rate && metrics.cancellation_rate > 10 ? 'destructive' : 'secondary'}>
                  {metrics?.cancellation_rate?.toFixed(1) ?? 0}%
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  Waitlist Entries
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {metrics?.waitlist_count ?? 0}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Volunteer Leaderboard */}
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-slate-500" />
                Top Volunteers
              </CardTitle>
              <Link href="/volunteers">
                <Button variant="ghost" size="sm">
                  View all
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-24 mb-1" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : volunteerLeaderboard.length > 0 ? (
                <div className="space-y-3">
                  {volunteerLeaderboard.slice(0, 5).map((volunteer, index) => (
                    <div key={volunteer.id} className="flex items-center gap-3">
                      <div className={`
                        w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                        ${index === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' : ''}
                        ${index === 1 ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300' : ''}
                        ${index === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400' : ''}
                        ${index > 2 ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' : ''}
                      `}>
                        {volunteer.rank}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                          {volunteer.user.first_name} {volunteer.user.last_name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {volunteer.total_hours} hours · {volunteer.total_sessions} sessions
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 text-amber-500" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {volunteer.rating.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-slate-500 dark:text-slate-400 py-4">
                  No volunteer data available
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
