'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { getParticipants, type ParticipantFilters } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Search,
  Users,
  ChevronRight,
  Accessibility,
} from 'lucide-react'
import { format } from 'date-fns'
import type { Participant } from '@/types'

const membershipTypes = [
  { value: 'adhoc', label: 'Ad-hoc' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'twice_weekly', label: 'Twice Weekly' },
  { value: '3plus_weekly', label: '3+ Weekly' },
]

export default function ParticipantsPage() {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [total, setTotal] = useState(0)
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMembership, setSelectedMembership] = useState<string>('all')

  const fetchParticipants = useCallback(async () => {
    setIsLoading(true)
    
    const filters: ParticipantFilters = { limit: 100 }
    
    const result = await getParticipants(filters)
    
    if (result.success && result.data) {
      let filtered = result.data.participants
      
      // Client-side filters
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        filtered = filtered.filter(
          (p) =>
            p.user?.first_name?.toLowerCase().includes(query) ||
            p.user?.last_name?.toLowerCase().includes(query) ||
            p.user?.email?.toLowerCase().includes(query) ||
            p.user?.phone?.includes(query)
        )
      }
      
      if (selectedMembership && selectedMembership !== 'all') {
        filtered = filtered.filter((p) => p.membership_type === selectedMembership)
      }
      
      setParticipants(filtered)
      setTotal(result.data.pagination.total || 0)
    }
    
    setIsLoading(false)
  }, [searchQuery, selectedMembership])

  useEffect(() => {
    fetchParticipants()
  }, [fetchParticipants])

  const getMembershipBadgeColor = (type: string) => {
    switch (type) {
      case 'adhoc':
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
      case 'weekly':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
      case 'twice_weekly':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
      case '3plus_weekly':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
      default:
        return 'bg-slate-100 text-slate-700'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Participants
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Manage participant profiles and registrations
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950">
                <Users className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Total Participants
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {total}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {membershipTypes.slice(0, 3).map((type) => (
          <Card key={type.value} className="border-slate-200 dark:border-slate-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Badge className={getMembershipBadgeColor(type.value)}>
                  {type.label}
                </Badge>
                <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {participants.filter((p) => p.membership_type === type.value).length}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            {/* Membership Filter */}
            <Select value={selectedMembership} onValueChange={setSelectedMembership}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="All memberships" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All memberships</SelectItem>
                {membershipTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Participants Table */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-48 mb-2" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : participants.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Participant</TableHead>
                  <TableHead>Membership</TableHead>
                  <TableHead>Accessibility</TableHead>
                  <TableHead>Emergency Contact</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {participants.map((participant) => (
                  <TableRow key={participant.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="text-sm bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                            {participant.user?.first_name?.[0]}
                            {participant.user?.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-slate-100">
                            {participant.user?.first_name}{' '}
                            {participant.user?.last_name}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {participant.user?.email || participant.user?.phone}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getMembershipBadgeColor(participant.membership_type)}>
                        {membershipTypes.find((t) => t.value === participant.membership_type)?.label || participant.membership_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {participant.accessibility_needs && participant.accessibility_needs.length > 0 ? (
                        <div className="flex items-center gap-1">
                          <Accessibility className="h-4 w-4 text-blue-500" />
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            {participant.accessibility_needs.length} needs
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400">
                      {participant.emergency_contact_name || (
                        <span className="text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-500 dark:text-slate-400">
                      {format(new Date(participant.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <Link href={`/participants/${participant.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <Users className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                No participants found
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-center">
                Try adjusting your search or filters.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
