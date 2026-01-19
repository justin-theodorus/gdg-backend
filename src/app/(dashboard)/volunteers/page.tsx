'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { getVolunteers, getVolunteerLeaderboard, type VolunteerFilters } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  Search,
  Star,
  Clock,
  Trophy,
  ChevronRight,
  HandHeart,
  LayoutGrid,
  List,
} from 'lucide-react'
import type { Volunteer } from '@/types'

const skills = [
  'first_aid',
  'teaching',
  'driving',
  'translation',
  'music',
  'cooking',
  'sports',
  'tech',
]

const interests = [
  'sports',
  'arts',
  'tech',
  'cooking',
  'music',
  'education',
  'social',
  'outdoor',
]

export default function VolunteersPage() {
  const [volunteers, setVolunteers] = useState<Volunteer[]>([])
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSkill, setSelectedSkill] = useState<string>('all')
  const [selectedInterest, setSelectedInterest] = useState<string>('all')

  const fetchVolunteers = useCallback(async () => {
    setIsLoading(true)
    
    const filters: VolunteerFilters = { limit: 100 }
    
    if (selectedSkill && selectedSkill !== 'all') {
      filters.skill = selectedSkill
    }
    if (selectedInterest && selectedInterest !== 'all') {
      filters.interest = selectedInterest
    }
    
    const [volunteersResult, leaderboardResult] = await Promise.all([
      getVolunteers(filters),
      getVolunteerLeaderboard(10, 'total_hours'),
    ])
    
    if (volunteersResult.success && volunteersResult.data) {
      let filtered = volunteersResult.data.volunteers
      
      // Client-side search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        filtered = filtered.filter(
          (v) =>
            v.user?.first_name?.toLowerCase().includes(query) ||
            v.user?.last_name?.toLowerCase().includes(query) ||
            v.user?.email?.toLowerCase().includes(query)
        )
      }
      
      setVolunteers(filtered)
      setTotal(volunteersResult.data.pagination.total || 0)
    }
    
    if (leaderboardResult.success && leaderboardResult.data) {
      setLeaderboard(leaderboardResult.data.leaderboard)
    }
    
    setIsLoading(false)
  }, [selectedSkill, selectedInterest, searchQuery])

  useEffect(() => {
    fetchVolunteers()
  }, [fetchVolunteers])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Volunteers
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Manage volunteer profiles and assignments
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950">
                <HandHeart className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Total Volunteers
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {total}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950">
                <Trophy className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Top Contributor
                </p>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {leaderboard[0]?.user?.first_name} {leaderboard[0]?.user?.last_name}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Total Hours
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {volunteers.reduce((sum, v) => sum + v.total_hours, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="directory" className="space-y-6">
        <TabsList>
          <TabsTrigger value="directory">Directory</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
        </TabsList>

        <TabsContent value="directory" className="space-y-6">
          {/* Filters */}
          <Card className="border-slate-200 dark:border-slate-800">
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search volunteers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                
                {/* Skill Filter */}
                <Select value={selectedSkill} onValueChange={setSelectedSkill}>
                  <SelectTrigger className="w-full lg:w-[160px]">
                    <SelectValue placeholder="All skills" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All skills</SelectItem>
                    {skills.map((skill) => (
                      <SelectItem key={skill} value={skill}>
                        {skill.replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {/* Interest Filter */}
                <Select value={selectedInterest} onValueChange={setSelectedInterest}>
                  <SelectTrigger className="w-full lg:w-[160px]">
                    <SelectValue placeholder="All interests" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All interests</SelectItem>
                    {interests.map((interest) => (
                      <SelectItem key={interest} value={interest}>
                        {interest}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
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
            </CardContent>
          </Card>

          {/* Volunteers Grid/List */}
          {isLoading ? (
            <div className={viewMode === 'grid' ? 'grid gap-4 md:grid-cols-2 xl:grid-cols-3' : 'space-y-3'}>
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="border-slate-200 dark:border-slate-800">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-5 w-32 mb-2" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : volunteers.length > 0 ? (
            <div className={viewMode === 'grid' ? 'grid gap-4 md:grid-cols-2 xl:grid-cols-3' : 'space-y-3'}>
              {volunteers.map((volunteer) => (
                <Link key={volunteer.id} href={`/volunteers/${volunteer.id}`}>
                  <Card className="border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-600 text-white">
                            {volunteer.user?.first_name?.[0]}
                            {volunteer.user?.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                            {volunteer.user?.first_name} {volunteer.user?.last_name}
                          </h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                            {volunteer.user?.email}
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
                              <Star className="h-4 w-4 text-amber-500" />
                              {volunteer.rating.toFixed(1)}
                            </span>
                            <span className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
                              <Clock className="h-4 w-4" />
                              {volunteer.total_hours}h
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-slate-400" />
                      </div>
                      
                      {(volunteer.skills?.length > 0 || volunteer.interests?.length > 0) && (
                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                          <div className="flex flex-wrap gap-1">
                            {volunteer.skills?.slice(0, 3).map((skill) => (
                              <Badge key={skill} variant="secondary" className="text-xs">
                                {skill.replace('_', ' ')}
                              </Badge>
                            ))}
                            {volunteer.interests?.slice(0, 2).map((interest) => (
                              <Badge key={interest} variant="outline" className="text-xs">
                                {interest}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="border-slate-200 dark:border-slate-800">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <HandHeart className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                  No volunteers found
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-center">
                  Try adjusting your filters.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="leaderboard">
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                Top Volunteers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {leaderboard.map((volunteer, index) => (
                  <Link key={volunteer.id} href={`/volunteers/${volunteer.id}`}>
                    <div className="flex items-center gap-4 p-4 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors cursor-pointer">
                      <div className={`
                        w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold
                        ${index === 0 ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-white' : ''}
                        ${index === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white' : ''}
                        ${index === 2 ? 'bg-gradient-to-br from-orange-400 to-amber-500 text-white' : ''}
                        ${index > 2 ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' : ''}
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
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                          {volunteer.user?.first_name} {volunteer.user?.last_name}
                        </h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {volunteer.total_sessions} sessions completed
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                          {volunteer.total_hours}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          hours
                        </p>
                      </div>
                      <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950">
                        <Star className="h-4 w-4 text-amber-500" />
                        <span className="font-semibold text-amber-700 dark:text-amber-400">
                          {volunteer.rating.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
