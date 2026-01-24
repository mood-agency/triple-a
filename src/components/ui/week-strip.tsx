"use client"

import * as React from "react"
import { addDays, format, isSameDay, startOfDay } from "date-fns"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import type { Locale } from "date-fns"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface WeekStripProps {
  selectedDate?: Date
  onSelectDate?: (date: Date) => void
  modifiers?: {
    hasTodo?: Date[]
    hasMeeting?: Date[]
    hasFollowup?: Date[]
  }
  locale?: Locale
  className?: string
}

function WeekStrip({
  selectedDate,
  onSelectDate,
  modifiers,
  locale,
  className,
}: WeekStripProps) {
  const today = startOfDay(new Date())
  const [centerDate, setCenterDate] = React.useState(today)

  // Generate 9 days: 4 before center, center, 4 after center
  const days = React.useMemo(() => {
    const result: Date[] = []
    for (let i = -4; i <= 4; i++) {
      result.push(addDays(centerDate, i))
    }
    return result
  }, [centerDate])

  const handlePrevious = () => {
    setCenterDate((prev) => addDays(prev, -7))
  }

  const handleNext = () => {
    setCenterDate((prev) => addDays(prev, 7))
  }

  const handleToday = () => {
    setCenterDate(today)
    onSelectDate?.(today)
  }

  // Check if a date has tasks
  const hasIndicator = (date: Date, type: "hasTodo" | "hasMeeting" | "hasFollowup") => {
    const dates = modifiers?.[type]
    if (!dates) return false
    return dates.some((d) => isSameDay(d, date))
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {/* Previous button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={handlePrevious}
      >
        <ChevronLeftIcon className="h-4 w-4" />
      </Button>

      {/* Days */}
      <div className="flex items-center gap-1">
        {days.map((day) => {
          const isSelected = selectedDate && isSameDay(day, selectedDate)
          const isToday = isSameDay(day, today)
          const hasTodo = hasIndicator(day, "hasTodo")
          const hasMeeting = hasIndicator(day, "hasMeeting")
          const hasFollowup = hasIndicator(day, "hasFollowup")
          const hasAnyIndicator = hasTodo || hasMeeting || hasFollowup

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDate?.(day)}
              className={cn(
                "relative flex min-w-[3rem] flex-col items-center gap-0.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
                isToday && !isSelected && "bg-accent text-accent-foreground"
              )}
            >
              {/* Day name */}
              <span className="text-[0.65rem] font-medium uppercase opacity-70">
                {format(day, "EEE", { locale })}
              </span>
              {/* Day number */}
              <span className="text-sm font-semibold">
                {format(day, "d")}
              </span>
              {/* Indicators */}
              {hasAnyIndicator && (
                <span className="absolute bottom-0.5 left-1/2 flex -translate-x-1/2 gap-0.5">
                  {hasTodo && <span className="size-1.5 rounded-full bg-red-500" />}
                  {hasMeeting && <span className="size-1.5 rounded-full bg-green-500" />}
                  {hasFollowup && <span className="size-1.5 rounded-full bg-yellow-500" />}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Next button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={handleNext}
      >
        <ChevronRightIcon className="h-4 w-4" />
      </Button>

      {/* Today button - only show if not centered on today */}
      {!isSameDay(centerDate, today) && (
        <Button
          variant="outline"
          size="sm"
          className="ml-1 h-8 text-xs"
          onClick={handleToday}
        >
          Hoy
        </Button>
      )}
    </div>
  )
}

export { WeekStrip }
