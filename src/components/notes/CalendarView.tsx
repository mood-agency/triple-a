import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { es, enUS } from 'date-fns/locale'
import { CalendarX2, Calendar as CalendarIcon } from 'lucide-react'
import { WeekStrip } from '@/components/ui/week-strip'
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

  const { notesByDate } = useCalendarNotes(notes, categoryFilter)

  // Check if there are any tasks with deadlines
  const hasAnyTasks = notesByDate.size > 0

  // Dates by category for colored dots
  const { todosDates, meetingsDates, followupsDates } = useMemo(() => {
    const todos: Date[] = []
    const meetings: Date[] = []
    const followups: Date[] = []

    notesByDate.forEach((notesForDate, dateStr) => {
      const date = new Date(dateStr + 'T00:00:00')
      const hasTodo = notesForDate.some((note) => note.category === 'todo')
      const hasMeeting = notesForDate.some((note) => note.category === 'meeting')
      const hasFollowup = notesForDate.some((note) => note.category === 'followup')

      if (hasTodo) todos.push(date)
      if (hasMeeting) meetings.push(date)
      if (hasFollowup) followups.push(date)
    })

    return { todosDates: todos, meetingsDates: meetings, followupsDates: followups }
  }, [notesByDate])

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
      {/* Week strip - compact 7-day view */}
      <WeekStrip
        selectedDate={selectedDate}
        onSelectDate={(date) => onSelectDate(date)}
        modifiers={{
          hasTodo: todosDates,
          hasMeeting: meetingsDates,
          hasFollowup: followupsDates,
        }}
        locale={locale}
      />

      {/* Legend */}
      <div className="mt-3 pt-3 border-t flex flex-wrap gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-red-500" />
          <span>{t('categoryTodo')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-yellow-500" />
          <span>{t('categoryFollowUp')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-green-500" />
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
