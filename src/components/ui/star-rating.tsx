'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StarRatingProps {
  value: number
  onChange?: (value: number) => void
  max?: number
  size?: 'sm' | 'md' | 'lg'
  readonly?: boolean
  showValue?: boolean
  className?: string
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
}

export function StarRating({
  value,
  onChange,
  max = 5,
  size = 'md',
  readonly = false,
  showValue = false,
  className,
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null)

  const displayValue = hoverValue !== null ? hoverValue : value

  const handleClick = (rating: number) => {
    if (!readonly && onChange) {
      onChange(rating)
    }
  }

  const handleMouseEnter = (rating: number) => {
    if (!readonly) {
      setHoverValue(rating)
    }
  }

  const handleMouseLeave = () => {
    setHoverValue(null)
  }

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: max }, (_, i) => {
          const rating = i + 1
          const isFilled = rating <= displayValue

          return (
            <button
              key={rating}
              type="button"
              onClick={() => handleClick(rating)}
              onMouseEnter={() => handleMouseEnter(rating)}
              onMouseLeave={handleMouseLeave}
              disabled={readonly}
              className={cn(
                'transition-colors focus:outline-none',
                !readonly && 'cursor-pointer hover:scale-110',
                readonly && 'cursor-default'
              )}
            >
              <Star
                className={cn(
                  sizeClasses[size],
                  'transition-colors',
                  isFilled
                    ? 'fill-amber-400 text-amber-400'
                    : 'fill-transparent text-slate-300 dark:text-slate-600'
                )}
              />
            </button>
          )
        })}
      </div>
      {showValue && (
        <span className="ml-2 text-sm font-medium text-slate-600 dark:text-slate-400">
          {value > 0 ? value.toFixed(1) : '—'}
        </span>
      )}
    </div>
  )
}
