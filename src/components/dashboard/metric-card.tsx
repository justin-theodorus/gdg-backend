import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  trend?: {
    value: number
    label: string
    direction: 'up' | 'down'
  }
  iconColor?: string
  iconBgColor?: string
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  iconColor = 'text-rose-600',
  iconBgColor = 'bg-rose-100 dark:bg-rose-950/50',
}: MetricCardProps) {
  return (
    <Card className="border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {title}
            </p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {value}
              </h3>
              {subtitle && (
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {subtitle}
                </span>
              )}
            </div>
            {trend && (
              <div className="flex items-center gap-1.5">
                {trend.direction === 'up' ? (
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                <span
                  className={cn(
                    'text-sm font-medium',
                    trend.direction === 'up' ? 'text-emerald-600' : 'text-red-600'
                  )}
                >
                  {trend.value}%
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {trend.label}
                </span>
              </div>
            )}
          </div>
          <div className={cn('p-3 rounded-xl', iconBgColor)}>
            <Icon className={cn('h-6 w-6', iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
