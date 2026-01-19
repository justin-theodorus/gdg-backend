'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { getActivities, getPrograms, type ActivityFilters } from '@/lib/api-client'
import { ActivityCard } from '@/components/dashboard/activity-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
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
  Plus,
  Search,
  CalendarDays,
  LayoutGrid,
  List,
  Filter,
  X,
} from 'lucide-react'
import { format, startOfToday, addDays, addMonths } from 'date-fns'
import type { Activity, Program } from '@/types'

export default function ActivitiesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [activities, setActivities] = useState<Activity[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProgram, setSelectedProgram] = useState<string>('all')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [showPast, setShowPast] = useState(false)

  const fetchActivities = useCallback(async () => {
    setIsLoading(true)
    
    const filters: ActivityFilters = {
      limit: 50,
      include_past: showPast,
    }
    
    if (selectedProgram && selectedProgram !== 'all') {
      filters.program_id = selectedProgram
    }
    if (selectedType && selectedType !== 'all') {
      filters.activity_type = selectedType
    }
    
    const result = await getActivities(filters)
    
    if (result.success && result.data) {
      let filtered = result.data.activities
      
      // Client-side search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        filtered = filtered.filter(
          (a) =>
            a.title.toLowerCase().includes(query) ||
            a.description?.toLowerCase().includes(query) ||
            a.location?.toLowerCase().includes(query)
        )
      }
      
      setActivities(filtered)
      setTotal(result.data.pagination.total || 0)
    }
    
    setIsLoading(false)
  }, [selectedProgram, selectedType, showPast, searchQuery])

  useEffect(() => {
    fetchActivities()
  }, [fetchActivities])

  useEffect(() => {
    async function fetchPrograms() {
      const result = await getPrograms()
      if (result.success && result.data) {
        setPrograms(result.data.programs || [])
      }
    }
    fetchPrograms()
  }, [])

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedProgram('all')
    setSelectedType('all')
    setShowPast(false)
  }

  const hasActiveFilters = searchQuery || selectedProgram !== 'all' || selectedType !== 'all' || showPast

  const activityTypes = [
    { value: 'exercise', label: 'Exercise' },
    { value: 'arts', label: 'Arts & Crafts' },
    { value: 'social', label: 'Social' },
    { value: 'educational', label: 'Educational' },
    { value: 'therapy', label: 'Therapy' },
    { value: 'recreation', label: 'Recreation' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Activities
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Manage and schedule activities for participants
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/activities/calendar">
            <Button variant="outline">
              <CalendarDays className="h-4 w-4 mr-2" />
              Calendar
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

      {/* Filters */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search activities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            {/* Program Filter */}
            <Select value={selectedProgram} onValueChange={setSelectedProgram}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="All programs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All programs</SelectItem>
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
            
            {/* Type Filter */}
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-full lg:w-[160px]">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {activityTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Show Past Toggle */}
            <Button
              variant={showPast ? 'secondary' : 'outline'}
              onClick={() => setShowPast(!showPast)}
              className="shrink-0"
            >
              {showPast ? 'Showing Past' : 'Show Past'}
            </Button>
            
            {/* View Mode */}
            <div className="flex border border-slate-200 dark:border-slate-800 rounded-lg p-1">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Active Filters */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Active filters:
              </span>
              {searchQuery && (
                <Badge variant="secondary" className="gap-1">
                  Search: {searchQuery}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setSearchQuery('')}
                  />
                </Badge>
              )}
              {selectedProgram !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  Program: {programs.find((p) => p.id === selectedProgram)?.name}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setSelectedProgram('all')}
                  />
                </Badge>
              )}
              {selectedType !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  Type: {activityTypes.find((t) => t.value === selectedType)?.label}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setSelectedType('all')}
                  />
                </Badge>
              )}
              {showPast && (
                <Badge variant="secondary" className="gap-1">
                  Including past
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setShowPast(false)}
                  />
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-slate-500 hover:text-slate-900"
              >
                Clear all
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Showing {activities.length} activities
        </p>
      </div>

      {/* Activities Grid/List */}
      {isLoading ? (
        <div className={viewMode === 'grid' ? 'grid gap-4 md:grid-cols-2 xl:grid-cols-3' : 'space-y-3'}>
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="border-slate-200 dark:border-slate-800">
              <CardContent className="p-5">
                <Skeleton className="h-5 w-24 mb-3" />
                <Skeleton className="h-6 w-3/4 mb-3" />
                <Skeleton className="h-4 w-1/2 mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : activities.length > 0 ? (
        <div className={viewMode === 'grid' ? 'grid gap-4 md:grid-cols-2 xl:grid-cols-3' : 'space-y-3'}>
          {activities.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              compact={viewMode === 'list'}
            />
          ))}
        </div>
      ) : (
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CalendarDays className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
              No activities found
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-center mb-6">
              {hasActiveFilters
                ? 'Try adjusting your filters to find activities.'
                : 'Get started by creating your first activity.'}
            </p>
            {!hasActiveFilters && (
              <Link href="/activities/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Activity
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
