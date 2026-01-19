'use client'

import { create } from 'zustand'

interface DashboardMetrics {
  total_registrations: number
  unique_participants: number
  active_volunteers: number
  average_satisfaction: number
  total_activities: number
  cancellation_rate: number
  upcoming_activities: number
  waitlist_count: number
}

interface DashboardState {
  metrics: DashboardMetrics | null
  period: { days: number; start_date: string; end_date: string } | null
  popularActivities: Array<{
    id: string
    title: string
    current_bookings: number
    capacity: number
    fill_rate: number
    start_datetime: string
    program?: { name: string; color: string }
  }>
  volunteerLeaderboard: Array<{
    rank: number
    id: string
    total_hours: number
    total_sessions: number
    rating: number
    user: { first_name: string; last_name: string }
  }>
  isLoading: boolean
  error: string | null
  selectedDays: number
}

interface DashboardActions {
  setMetrics: (metrics: DashboardMetrics) => void
  setPeriod: (period: { days: number; start_date: string; end_date: string }) => void
  setPopularActivities: (activities: DashboardState['popularActivities']) => void
  setVolunteerLeaderboard: (leaderboard: DashboardState['volunteerLeaderboard']) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setSelectedDays: (days: number) => void
  refreshDashboard: () => Promise<void>
}

type DashboardStore = DashboardState & DashboardActions

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  metrics: null,
  period: null,
  popularActivities: [],
  volunteerLeaderboard: [],
  isLoading: false,
  error: null,
  selectedDays: 7,

  setMetrics: (metrics) => set({ metrics }),
  setPeriod: (period) => set({ period }),
  setPopularActivities: (activities) => set({ popularActivities: activities }),
  setVolunteerLeaderboard: (leaderboard) => set({ volunteerLeaderboard: leaderboard }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setSelectedDays: (days) => set({ selectedDays: days }),

  refreshDashboard: async () => {
    const { selectedDays } = get()
    set({ isLoading: true, error: null })

    try {
      const { getDashboardStats } = await import('@/lib/api-client')
      const response = await getDashboardStats(selectedDays)

      if (response.success && response.data) {
        set({
          metrics: response.data.metrics,
          period: response.data.period,
          popularActivities: response.data.popular_activities || [],
          volunteerLeaderboard: response.data.volunteer_leaderboard || [],
          isLoading: false,
        })
      } else {
        set({
          error: response.error?.message || 'Failed to load dashboard',
          isLoading: false,
        })
      }
    } catch (err) {
      set({
        error: 'Failed to load dashboard data',
        isLoading: false,
      })
    }
  },
}))
