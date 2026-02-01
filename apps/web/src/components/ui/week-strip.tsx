"use client"

import * as React from "react"
import { addDays, format, isSameDay, startOfDay, differenceInDays, type Locale } from "date-fns"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "motion/react"

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
  const [direction, setDirection] = React.useState(0)
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
    setDirection(-1)
    setCenterDate((prev) => addDays(prev, -visibleDays))
  }

  const handleNext = () => {
    setDirection(1)
    setCenterDate((prev) => addDays(prev, visibleDays))
  }

  const handleToday = () => {
    setDirection(isSameDay(centerDate, today) ? 0 : (centerDate > today ? -1 : 1))
    setCenterDate(today)
    onSelectDate?.(today)
  }

  // Check if a date has tasks
  const hasIndicator = (date: Date, type: "hasTodo" | "hasMeeting" | "hasFollowup") => {
    const dates = modifiers?.[type]
    if (!dates) return false
    return dates.some((d) => isSameDay(d, date))
  }

  const focalDate = selectedDate || today

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

        {/* Days container */}
        <div ref={daysContainerRef} className="relative flex min-w-0 flex-1 items-center overflow-hidden h-12">
          <AnimatePresence initial={false} mode="popLayout" custom={direction}>
            <motion.div
              key={centerDate.toISOString()}
              custom={direction}
              variants={{
                enter: (direction: number) => ({
                  x: direction > 0 ? 100 : -100,
                  opacity: 0,
                }),
                center: {
                  zIndex: 1,
                  x: 0,
                  opacity: 1,
                },
                exit: (direction: number) => ({
                  zIndex: 0,
                  x: direction < 0 ? 100 : -100,
                  opacity: 0,
                }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 },
              }}
              className="flex w-full items-center gap-1"
            >
              {days.map((day) => {
                const isSelected = selectedDate && isSameDay(day, selectedDate)
                const isToday = isSameDay(day, today)
                const hasTodo = hasIndicator(day, "hasTodo")
                const hasMeeting = hasIndicator(day, "hasMeeting")
                const hasFollowup = hasIndicator(day, "hasFollowup")
                const hasAnyIndicator = hasTodo || hasMeeting || hasFollowup

                // Calculate staggering delay based on distance to focal date
                const diff = Math.abs(differenceInDays(startOfDay(day), startOfDay(focalDate)))
                const delay = diff * 0.04

                return (
                  <motion.button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => onSelectDate?.(day)}
                    initial={{ opacity: 0, scale: 0.8, y: 5 }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                      y: 0,
                      transition: {
                        delay,
                        type: "spring",
                        stiffness: 400,
                        damping: 25
                      }
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
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
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: delay + 0.2 }}
                        className="absolute bottom-1 left-1/2 flex -translate-x-1/2 gap-0.5"
                      >
                        {hasTodo && <span className="size-1 rounded-full bg-red-500" />}
                        {hasMeeting && <span className="size-1 rounded-full bg-green-500" />}
                        {hasFollowup && <span className="size-1 rounded-full bg-yellow-500" />}
                      </motion.span>
                    )}
                  </motion.button>
                )
              })}
            </motion.div>
          </AnimatePresence>
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
