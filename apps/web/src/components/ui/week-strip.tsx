"use client"

import * as React from "react"
import { addDays, format, isSameDay, startOfDay, type Locale } from "date-fns"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

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
  const daysContainerRef = React.useRef<HTMLDivElement>(null)
  const [visibleDays, setVisibleDays] = React.useState(7)

  const DAY_WIDTH = 50 // px per day cell
  const GAP = 4 // gap between cells

  React.useEffect(() => {
    const el = daysContainerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width
      // Each day takes DAY_WIDTH + GAP, minus one gap
      const count = Math.max(1, Math.floor((width + GAP) / (DAY_WIDTH + GAP)))
      // Keep it odd so center date stays centered
      const odd = count % 2 === 0 ? count - 1 : count
      setVisibleDays(odd)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const half = Math.floor(visibleDays / 2)

  const days = React.useMemo(() => {
    const result: Date[] = []
    for (let i = -half; i <= half; i++) {
      result.push(addDays(centerDate, i))
    }
    return result
  }, [centerDate, half])

  const handlePrevious = () => {
    setCenterDate((prev) => addDays(prev, -visibleDays))
  }

  const handleNext = () => {
    setCenterDate((prev) => addDays(prev, visibleDays))
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
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Month and Year header with Today link */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium capitalize text-muted-foreground">
          {format(centerDate, "MMMM yyyy", { locale })}
        </span>
        {!isSameDay(centerDate, today) && (
          <button
            type="button"
            onClick={handleToday}
            className="text-xs font-medium text-primary hover:underline"
          >
            Hoy
          </button>
        )}
      </div>

      {/* Week navigation */}
      <div className="flex items-center gap-1">
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
      <div ref={daysContainerRef} className="flex min-w-0 flex-1 items-center gap-1">
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
                "relative flex flex-1 flex-col items-center gap-0.5 rounded-md py-1.5 text-sm transition-colors",
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
      </div>
    </div>
  )
}

export { WeekStrip }
