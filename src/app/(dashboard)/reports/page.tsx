'use client'

import { useEffect, useState } from 'react'
import { getDashboardStats, getVolunteerLeaderboard, getActivities, getBookings } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
} from 'recharts'
import {
  BarChart3,
  TrendingUp,
  Users,
  Star,
  Calendar,
  Trophy,
  PieChart as PieChartIcon,
  Activity,
} from 'lucide-react'
import { format, subDays, eachDayOfInterval, startOfDay } from 'date-fns'
import type { Activity as ActivityType, Booking } from '@/types'

const COLORS = ['#f43f5e', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ec4899']

export default function ReportsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDays, setSelectedDays] = useState('30')
  const [metrics, setMetrics] = useState<any>(null)
  const [popularActivities, setPopularActivities] = useState<any[]>([])
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [activities, setActivities] = useState<ActivityType[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  
  // Computed data for charts
  const [attendanceTrend, setAttendanceTrend] = useState<any[]>([])
  const [activityTypeDistribution, setActivityTypeDistribution] = useState<any[]>([])
  const [bookingStatusDistribution, setBookingStatusDistribution] = useState<any[]>([])

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true)
      
      const days = parseInt(selectedDays)
      const startDate = subDays(new Date(), days)
      
      const [dashboardResult, leaderboardResult, activitiesResult, bookingsResult] = await Promise.all([
        getDashboardStats(days),
        getVolunteerLeaderboard(10, 'total_hours'),
        getActivities({ start_date: startDate.toISOString(), include_past: true, limit: 200 }),
        getBookings({ limit: 500 }),
      ])
      
      if (dashboardResult.success && dashboardResult.data) {
        setMetrics(dashboardResult.data.metrics)
        setPopularActivities(dashboardResult.data.popular_activities || [])
      }
      
      if (leaderboardResult.success && leaderboardResult.data) {
        setLeaderboard(leaderboardResult.data.leaderboard || [])
      }
      
      if (activitiesResult.success && activitiesResult.data) {
        setActivities(activitiesResult.data.activities)
        
        // Calculate activity type distribution
        const typeCount: Record<string, number> = {}
        activitiesResult.data.activities.forEach((a) => {
          const type = a.activity_type || 'other'
          typeCount[type] = (typeCount[type] || 0) + 1
        })
        setActivityTypeDistribution(
          Object.entries(typeCount).map(([name, value]) => ({ name, value }))
        )
      }
      
      if (bookingsResult.success && bookingsResult.data) {
        setBookings(bookingsResult.data.bookings)
        
        // Calculate attendance trend (last N days)
        const interval = eachDayOfInterval({
          start: startDate,
          end: new Date(),
        })
        
        const trendData = interval.map((date) => {
          const dayStart = startOfDay(date)
          const dayBookings = bookingsResult.data!.bookings.filter((b) => {
            const bookingDate = startOfDay(new Date(b.created_at))
            return bookingDate.getTime() === dayStart.getTime()
          })
          
          return {
            date: format(date, 'MMM d'),
            bookings: dayBookings.length,
            attended: dayBookings.filter((b) => b.attended).length,
          }
        })
        setAttendanceTrend(trendData)
        
        // Calculate booking status distribution
        const statusCount: Record<string, number> = {
          confirmed: 0,
          completed: 0,
          cancelled: 0,
          no_show: 0,
        }
        bookingsResult.data.bookings.forEach((b) => {
          statusCount[b.status] = (statusCount[b.status] || 0) + 1
        })
        setBookingStatusDistribution([
          { name: 'Confirmed', value: statusCount.confirmed, color: '#22c55e' },
          { name: 'Completed', value: statusCount.completed, color: '#06b6d4' },
          { name: 'Cancelled', value: statusCount.cancelled, color: '#ef4444' },
          { name: 'No Show', value: statusCount.no_show, color: '#f59e0b' },
        ])
      }
      
      setIsLoading(false)
    }
    
    fetchData()
  }, [selectedDays])

  // Calculate satisfaction distribution
  const satisfactionDistribution = bookings
    .filter((b) => b.feedback_rating)
    .reduce((acc, b) => {
      const rating = b.feedback_rating!
      acc[rating] = (acc[rating] || 0) + 1
      return acc
    }, {} as Record<number, number>)

  const satisfactionData = [1, 2, 3, 4, 5].map((rating) => ({
    rating: `${rating} Star`,
    count: satisfactionDistribution[rating] || 0,
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Reports & Analytics
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Insights and trends for your organization
          </p>
        </div>
        <Select value={selectedDays} onValueChange={setSelectedDays}>
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
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <Card key={i} className="border-slate-200 dark:border-slate-800">
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card className="border-slate-200 dark:border-slate-800">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    Total Registrations
                  </span>
                </div>
                <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                  {metrics?.total_registrations || 0}
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-slate-200 dark:border-slate-800">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    Unique Participants
                  </span>
                </div>
                <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                  {metrics?.unique_participants || 0}
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-slate-200 dark:border-slate-800">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="h-4 w-4 text-amber-500" />
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    Avg Satisfaction
                  </span>
                </div>
                <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                  {metrics?.average_satisfaction?.toFixed(1) || '0.0'}
                  <span className="text-lg text-slate-400"> / 5</span>
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-slate-200 dark:border-slate-800">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    Cancellation Rate
                  </span>
                </div>
                <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                  {metrics?.cancellation_rate?.toFixed(1) || '0'}%
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Charts */}
      <Tabs defaultValue="trends" className="space-y-6">
        <TabsList>
          <TabsTrigger value="trends">Attendance Trends</TabsTrigger>
          <TabsTrigger value="activities">Activity Analytics</TabsTrigger>
          <TabsTrigger value="volunteers">Volunteer Leaderboard</TabsTrigger>
          <TabsTrigger value="satisfaction">Satisfaction</TabsTrigger>
        </TabsList>

        {/* Attendance Trends */}
        <TabsContent value="trends" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-slate-500" />
                  Daily Registrations
                </CardTitle>
                <CardDescription>
                  Number of bookings created per day
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={attendanceTrend}>
                      <defs>
                        <linearGradient id="colorBookings" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 12 }}
                        className="text-slate-500"
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        className="text-slate-500"
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="bookings" 
                        stroke="#f43f5e" 
                        fillOpacity={1} 
                        fill="url(#colorBookings)" 
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5 text-slate-500" />
                  Booking Status Distribution
                </CardTitle>
                <CardDescription>
                  Breakdown of booking statuses
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={bookingStatusDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => {
                          const percentage = ((percent ?? 0) * 100)
                          return percentage > 0 ? `${name} ${percentage.toFixed(0)}%` : ''
                        }}
                        labelLine={false}
                      >
                        {bookingStatusDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Activity Analytics */}
        <TabsContent value="activities" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle>Activity Type Distribution</CardTitle>
                <CardDescription>
                  Breakdown of activities by type
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={activityTypeDistribution} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        tick={{ fontSize: 12 }}
                        width={80}
                      />
                      <Tooltip />
                      <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle>Popular Activities</CardTitle>
                <CardDescription>
                  Top activities by registration count
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {popularActivities.slice(0, 5).map((activity, index) => (
                      <div key={activity.id} className="flex items-center gap-4">
                        <div className={`
                          w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white
                          ${index === 0 ? 'bg-amber-500' : ''}
                          ${index === 1 ? 'bg-slate-400' : ''}
                          ${index === 2 ? 'bg-orange-400' : ''}
                          ${index > 2 ? 'bg-slate-300' : ''}
                        `}>
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 dark:text-slate-100 truncate">
                            {activity.title}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {activity.current_bookings} / {activity.capacity} registered
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                            {activity.fill_rate}%
                          </p>
                          <p className="text-xs text-slate-500">fill rate</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Volunteer Leaderboard */}
        <TabsContent value="volunteers">
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                Volunteer Contribution Leaderboard
              </CardTitle>
              <CardDescription>
                Top volunteers ranked by hours contributed
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(10)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : leaderboard.length > 0 ? (
                <div className="space-y-3">
                  {leaderboard.map((volunteer, index) => (
                    <div 
                      key={volunteer.id} 
                      className="flex items-center gap-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-900"
                    >
                      <div className={`
                        w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold
                        ${index === 0 ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-white' : ''}
                        ${index === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white' : ''}
                        ${index === 2 ? 'bg-gradient-to-br from-orange-400 to-amber-500 text-white' : ''}
                        ${index > 2 ? 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300' : ''}
                      `}>
                        {volunteer.rank}
                      </div>
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-600 text-white">
                          {volunteer.user?.first_name?.[0]}
                          {volunteer.user?.last_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {volunteer.user?.first_name} {volunteer.user?.last_name}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {volunteer.total_sessions} sessions completed
                        </p>
                      </div>
                      <div className="text-right mr-4">
                        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                          {volunteer.total_hours}
                        </p>
                        <p className="text-sm text-slate-500">hours</p>
                      </div>
                      <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950">
                        <Star className="h-4 w-4 text-amber-500" />
                        <span className="font-semibold text-amber-700 dark:text-amber-400">
                          {volunteer.rating.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-slate-500 dark:text-slate-400 py-8">
                  No volunteer data available
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Satisfaction */}
        <TabsContent value="satisfaction" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle>Satisfaction Rating Distribution</CardTitle>
                <CardDescription>
                  Breakdown of feedback ratings received
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={satisfactionData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                      <XAxis dataKey="rating" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle>Satisfaction Summary</CardTitle>
                <CardDescription>
                  Overall satisfaction metrics
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-amber-100 dark:bg-amber-950 mb-4">
                    <span className="text-4xl font-bold text-amber-600 dark:text-amber-400">
                      {metrics?.average_satisfaction?.toFixed(1) || '0.0'}
                    </span>
                  </div>
                  <p className="text-lg font-medium text-slate-900 dark:text-slate-100">
                    Average Rating
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Based on {bookings.filter((b) => b.feedback_rating).length} reviews
                  </p>
                </div>
                
                <div className="space-y-3">
                  {[5, 4, 3, 2, 1].map((rating) => {
                    const count = satisfactionDistribution[rating] || 0
                    const total = bookings.filter((b) => b.feedback_rating).length || 1
                    const percentage = (count / total) * 100
                    
                    return (
                      <div key={rating} className="flex items-center gap-3">
                        <span className="text-sm w-12 text-slate-600 dark:text-slate-400">
                          {rating} star
                        </span>
                        <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-sm w-12 text-right text-slate-600 dark:text-slate-400">
                          {count}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
