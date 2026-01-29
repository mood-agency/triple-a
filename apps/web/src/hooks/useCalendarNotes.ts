import { useMemo } from 'react'
import type { Note, NoteCategory, Label } from '@/types/note'
import { parseLocalDate, formatLocalDate, getLocalDateKey } from '@/utils/dateUtils'

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
  categoryFilter: NoteCategory | 'all' = 'all',
  labelFilter: string[] = [],
  assigneeFilter: string[] = [],
  searchQuery: string = '',
  showOverdueOnly: boolean = false,
  noteLabelsCache?: Map<string, Label[]>,
  noteAssigneesCache?: Map<string, string[]>
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

      // Apply label filter
      if (labelFilter.length > 0 && noteLabelsCache) {
        const noteLabelIds = (noteLabelsCache.get(note.id) ?? []).map(l => l.id)
        if (!labelFilter.some(labelId => noteLabelIds.includes(labelId))) return false
      }

      // Apply assignee filter
      if (assigneeFilter.length > 0 && noteAssigneesCache) {
        const noteAssigneeIds = noteAssigneesCache.get(note.id) ?? []
        if (!assigneeFilter.some(contactId => noteAssigneeIds.includes(contactId))) return false
      }

      // Apply search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const titleMatch = note.content.toLowerCase().includes(query)
        const descriptionMatch = note.description?.toLowerCase().includes(query) ?? false
        if (!titleMatch && !descriptionMatch) return false
      }

      // Apply overdue only filter
      if (showOverdueOnly) {
        const isOverdue = parseLocalDate(note.deadline) < new Date()
        if (!isOverdue) return false
      }

      return true
    })
  }, [notes, categoryFilter, labelFilter, assigneeFilter, searchQuery, showOverdueOnly, noteLabelsCache, noteAssigneesCache])

  // Group notes by deadline date (YYYY-MM-DD format)
  const notesByDate = useMemo(() => {
    const map = new Map<string, Note[]>()

    for (const note of calendarNotes) {
      if (!note.deadline) continue

      const dateKey = getLocalDateKey(note.deadline)
      const existing = map.get(dateKey) || []
      map.set(dateKey, [...existing, note])
    }

    return map
  }, [calendarNotes])

  // Get notes for a specific date
  const getNotesForDate = (date: Date): Note[] => {
    const dateKey = formatLocalDate(date)
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
