'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  UserCheck,
  HandHeart,
  ClipboardList,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Heart,
} from 'lucide-react'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

const navigation = [
  { name: 'Overview', href: '/', icon: LayoutDashboard },
  { name: 'Activities', href: '/activities', icon: CalendarDays },
  { name: 'Bookings', href: '/bookings', icon: ClipboardList },
  { name: 'Volunteers', href: '/volunteers', icon: HandHeart },
  { name: 'Participants', href: '/participants', icon: Users },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
]

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 transition-all duration-300',
        collapsed ? 'w-[68px]' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-md shadow-rose-500/20">
            <Heart className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <span className="font-bold text-lg tracking-tight">CareConnect</span>
          )}
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-8 w-8 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-4">
        <nav className="px-3 space-y-1">
          {navigation.map((item) => {
            const active = isActive(item.href)
            return (
              <Link key={item.name} href={item.href}>
                <Button
                  variant={active ? 'secondary' : 'ghost'}
                  className={cn(
                    'w-full justify-start gap-3 h-10',
                    active 
                      ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-400 dark:hover:bg-rose-950' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800',
                    collapsed && 'justify-center px-2'
                  )}
                >
                  <item.icon className={cn('h-5 w-5 shrink-0', active && 'text-rose-600 dark:text-rose-400')} />
                  {!collapsed && <span className="font-medium">{item.name}</span>}
                </Button>
              </Link>
            )
          })}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800">
        {!collapsed && (
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
            Staff Dashboard v1.0
          </p>
        )}
      </div>
    </div>
  )
}
