'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { getVolunteer } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  ArrowLeft,
  Star,
  Clock,
  Mail,
  Phone,
  Calendar,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react'
import type { Volunteer } from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
}

const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const timeSlots = ['morning', 'afternoon', 'evening']

export default function VolunteerDetailPage({ params }: PageProps) {
  const { id } = use(params)
  
  const [volunteer, setVolunteer] = useState<Volunteer | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true)
      
      const result = await getVolunteer(id)
      
      if (result.success && result.data) {
        setVolunteer(result.data)
      } else {
        setError('Volunteer not found')
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

  if (error || !volunteer) {
    return (
      <div className="space-y-6">
        <Link href="/volunteers">
          <Button variant="ghost">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Volunteers
          </Button>
        </Link>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error || 'Volunteer not found'}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link href="/volunteers">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-600 text-white text-xl">
                {volunteer.user?.first_name?.[0]}
                {volunteer.user?.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {volunteer.user?.first_name} {volunteer.user?.last_name}
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                  <Star className="h-4 w-4 text-amber-500" />
                  {volunteer.rating.toFixed(1)} rating
                </span>
                <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                  <Clock className="h-4 w-4" />
                  {volunteer.total_hours} hours
                </span>
                <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                  <CheckCircle className="h-4 w-4" />
                  {volunteer.total_sessions} sessions
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
            <div className="flex items-center justify-center mb-2">
              <Star className="h-8 w-8 text-amber-500" />
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              {volunteer.rating.toFixed(1)}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Rating</p>
          </CardContent>
        </Card>
        
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              {volunteer.total_hours}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Hours</p>
          </CardContent>
        </Card>
        
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <CheckCircle className="h-8 w-8 text-emerald-500" />
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              {volunteer.total_sessions}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Sessions</p>
          </CardContent>
        </Card>
        
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Calendar className="h-8 w-8 text-purple-500" />
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              {Object.keys(volunteer.availability || {}).length}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Days Available</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Contact Info */}
            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle className="text-lg">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {volunteer.user?.email && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                      <Mail className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Email</p>
                      <p className="text-slate-900 dark:text-slate-100">
                        {volunteer.user.email}
                      </p>
                    </div>
                  </div>
                )}
                
                {volunteer.user?.phone && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                      <Phone className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Phone</p>
                      <p className="text-slate-900 dark:text-slate-100">
                        {volunteer.user.phone}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Skills & Interests */}
            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle className="text-lg">Skills & Interests</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {volunteer.skills && volunteer.skills.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
                      Skills
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {volunteer.skills.map((skill) => (
                        <Badge key={skill} variant="secondary">
                          {skill.replace('_', ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {volunteer.interests && volunteer.interests.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
                      Interests
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {volunteer.interests.map((interest) => (
                        <Badge key={interest} variant="outline">
                          {interest}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {(!volunteer.skills || volunteer.skills.length === 0) && 
                 (!volunteer.interests || volunteer.interests.length === 0) && (
                  <p className="text-slate-500 dark:text-slate-400">
                    No skills or interests specified
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="availability">
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg">Weekly Availability</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-left py-2 pr-4 text-sm font-medium text-slate-500 dark:text-slate-400">
                        Day
                      </th>
                      {timeSlots.map((slot) => (
                        <th key={slot} className="text-center py-2 px-4 text-sm font-medium text-slate-500 dark:text-slate-400 capitalize">
                          {slot}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dayNames.map((day) => {
                      const dayKey = day.toLowerCase()
                      const dayAvailability = (volunteer.availability as Record<string, string[]>)?.[dayKey] || []
                      
                      return (
                        <tr key={day} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="py-3 pr-4 text-sm font-medium text-slate-900 dark:text-slate-100">
                            {day}
                          </td>
                          {timeSlots.map((slot) => {
                            const isAvailable = dayAvailability.includes(slot)
                            
                            return (
                              <td key={slot} className="text-center py-3 px-4">
                                <div className={`
                                  w-8 h-8 mx-auto rounded-lg flex items-center justify-center
                                  ${isAvailable 
                                    ? 'bg-emerald-100 dark:bg-emerald-950' 
                                    : 'bg-slate-100 dark:bg-slate-800'
                                  }
                                `}>
                                  {isAvailable ? (
                                    <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                  ) : (
                                    <span className="w-2 h-0.5 bg-slate-300 dark:bg-slate-600 rounded" />
                                  )}
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
