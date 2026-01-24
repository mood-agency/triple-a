import { useMemo } from 'react'
import type { Note, NoteCategory } from '@/types/note'
import { parseLocalDate } from '@/utils/dateUtils'

export interface CalendarNotesResult {
  notesByDate: Map<string, Note[]>
  getNotesForDate: (date: Date) => Note[]
  hasOverdueTasks: (date: Date) => boolean
  getTaskCountForDate: (date: Date) => number
}

/**
 * Hook for grouping notes by their deadline date for calendar display.
 * Only includes followups and meetings with deadlines.
 */
export function useCalendarNotes(
  notes: Note[],
  categoryFilter: NoteCategory | 'all' = 'all'
): CalendarNotesResult {
  // Filter to only open followups and meetings with deadlines
  const calendarNotes = useMemo(() => {
    return notes.filter((note) => {
      // Only show open (not completed) tasks
      if (note.completed) return false

      // Must have a deadline
      if (!note.deadline) return false

      // Only show todos, followups and meetings (not notes)
      if (note.category !== 'todo' && note.category !== 'followup' && note.category !== 'meeting') return false

      // Apply category filter if set
      if (categoryFilter !== 'all' && note.category !== categoryFilter) return false

      return true
    })
  }, [notes, categoryFilter])

  // Group notes by deadline date (YYYY-MM-DD format)
  const notesByDate = useMemo(() => {
    const map = new Map<string, Note[]>()

    for (const note of calendarNotes) {
      if (!note.deadline) continue

      const dateKey = note.deadline.split('T')[0]
      const existing = map.get(dateKey) || []
      map.set(dateKey, [...existing, note])
    }

    return map
  }, [calendarNotes])

  // Get notes for a specific date
  const getNotesForDate = (date: Date): Note[] => {
    // Use local date format to avoid timezone issues (toISOString converts to UTC)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const dateKey = `${year}-${month}-${day}`
    return notesByDate.get(dateKey) || []
  }

  // Get task count for a specific date
  const getTaskCountForDate = (date: Date): number => {
    return getNotesForDate(date).length
  }

  // Check if a date has overdue tasks
  const hasOverdueTasks = (date: Date): boolean => {
    const notesForDate = getNotesForDate(date)
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    return notesForDate.some((note) => {
      if (note.completed) return false
      const deadline = parseLocalDate(note.deadline!)
      return deadline < now
    })
  }

  return {
    notesByDate,
    getNotesForDate,
    hasOverdueTasks,
    getTaskCountForDate,
  }
}
