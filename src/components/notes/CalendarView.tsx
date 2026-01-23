import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { es, enUS } from 'date-fns/locale'
import { DayPicker } from 'react-day-picker'
import { ChevronLeft, ChevronRight, CalendarX2, Calendar as CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { useCalendarNotes } from '@/hooks/useCalendarNotes'
import type { Note, NoteCategory } from '@/types/note'

interface CalendarViewProps {
  notes: Note[]
  categoryFilter: NoteCategory | 'all'
  selectedDate: Date | undefined
  onSelectDate: (date: Date | undefined) => void
}

export function CalendarView({
  notes,
  categoryFilter,
  selectedDate,
  onSelectDate,
}: CalendarViewProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'es' ? es : enUS

  const { notesByDate, getNotesForDate } = useCalendarNotes(notes, categoryFilter)

  // Check if there are any tasks with deadlines
  const hasAnyTasks = notesByDate.size > 0

  // Dates that have tasks (for styling)
  const datesWithTasks = useMemo(() => {
    const dates: Date[] = []
    notesByDate.forEach((_, dateStr) => {
      dates.push(new Date(dateStr + 'T00:00:00'))
    })
    return dates
  }, [notesByDate])

  // Overdue dates
  const overdueDates = useMemo(() => {
    const dates: Date[] = []
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    notesByDate.forEach((notesForDate, dateStr) => {
      const date = new Date(dateStr + 'T00:00:00')
      const hasOverdue = notesForDate.some((note) => {
        if (note.completed) return false
        return date < now
      })
      if (hasOverdue) {
        dates.push(date)
      }
    })
    return dates
  }, [notesByDate])

  // Render dots for a specific date
  const renderDots = (date: Date) => {
    const notesForDate = getNotesForDate(date)
    if (notesForDate.length === 0) return null

    const todoCount = notesForDate.filter((n) => n.category === 'todo').length
    const followupCount = notesForDate.filter((n) => n.category === 'followup').length
    const meetingCount = notesForDate.filter((n) => n.category === 'meeting').length

    return (
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
        {todoCount > 0 && (
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
        )}
        {followupCount > 0 && (
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
        )}
        {meetingCount > 0 && (
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
        )}
      </div>
    )
  }

  if (!hasAnyTasks) {
    return (
      <div className="flex flex-col items-center justify-center text-muted-foreground p-8">
        <CalendarX2 className="h-12 w-12 mb-3 opacity-50" />
        <p className="text-sm font-medium">{t('calendar.noTasksWithDeadlines')}</p>
        <p className="text-xs mt-1">{t('calendar.addDeadlinesHint')}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Calendar with dots */}
      <DayPicker
        mode="single"
        selected={selectedDate}
        onSelect={onSelectDate}
        locale={locale}
        showOutsideDays
        className={cn('p-3 rounded-md border')}
        classNames={{
          months: 'flex flex-col sm:flex-row gap-2',
          month: 'flex flex-col gap-4',
          month_caption: 'flex justify-center pt-1 relative items-center h-7',
          caption_label: 'text-sm font-medium',
          nav: 'flex items-center gap-1',
          button_previous: cn(
            buttonVariants({ variant: 'outline' }),
            'absolute left-1 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 z-10'
          ),
          button_next: cn(
            buttonVariants({ variant: 'outline' }),
            'absolute right-1 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 z-10'
          ),
          month_grid: 'w-full border-collapse',
          weekdays: 'flex',
          weekday: 'text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] text-center',
          week: 'flex w-full mt-2',
          day: cn(
            'relative p-0 text-center text-sm focus-within:relative focus-within:z-20',
            '[&:has([aria-selected])]:bg-accent [&:has([aria-selected])]:rounded-md'
          ),
          day_button: cn(
            buttonVariants({ variant: 'ghost' }),
            'h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground relative'
          ),
          range_start: 'day-range-start rounded-l-md',
          range_end: 'day-range-end rounded-r-md',
          selected:
            'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-md',
          today: 'bg-accent text-accent-foreground rounded-md',
          outside: 'text-muted-foreground opacity-50',
          disabled: 'text-muted-foreground opacity-50',
          range_middle: 'aria-selected:bg-accent aria-selected:text-accent-foreground',
          hidden: 'invisible',
        }}
        modifiers={{
          hasTasks: datesWithTasks,
          overdue: overdueDates,
        }}
        modifiersClassNames={{
          hasTasks: 'font-bold',
          overdue: 'text-destructive',
        }}
        components={{
          Chevron: ({ orientation }) => {
            const Icon = orientation === 'left' ? ChevronLeft : ChevronRight
            return <Icon className="h-4 w-4" />
          },
          DayButton: ({ day, modifiers, ...props }) => {
            return (
              <button {...props} type="button" className={cn(props.className, 'pb-2')}>
                {day.date.getDate()}
                {renderDots(day.date)}
              </button>
            )
          },
        }}
      />

      {/* Legend */}
      <div className="mt-2 flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span>{t('categoryTodo')}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <span>{t('categoryFollowUp')}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-purple-500" />
          <span>{t('categoryMeeting')}</span>
        </div>
      </div>

      {/* Selected date header */}
      {selectedDate && (
        <div className="mt-3 pt-3 border-t text-xs text-muted-foreground flex items-center gap-2">
          <CalendarIcon className="h-3 w-3" />
          <span className="capitalize">
            {format(selectedDate, 'EEEE, MMMM d', { locale })}
          </span>
        </div>
      )}
    </div>
  )
}
