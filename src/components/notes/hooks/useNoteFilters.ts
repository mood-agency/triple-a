import { useState, useMemo, useRef } from 'react';
import type { Note, NoteCategory, Label } from '@/types/note';
import type { Contact } from '@/types/contact';
import { parseLocalDate, startOfDay, endOfDay, getLocalDateKey, formatLocalDate } from '@/utils/dateUtils';
import { sortNotes, sortCompletedNotes, type NoteSortConfig } from '@/utils/noteUtils';
import { useContacts } from '@/hooks/useContacts';
import { getInitials } from '@/lib/utils';
import { EMPTY_LABELS } from '@/constants/notes';

type SortConfigType = { deadline: 'asc' | 'desc' | null; assignee: 'asc' | 'desc' | null; category: 'asc' | 'desc' | null };

interface UseNoteFiltersProps {
    notes: Note[];
    deletedNotes: Note[];
    externalLabelFilter?: string[];
    externalCategoryFilter?: NoteCategory | 'all';
    externalAssigneeFilter?: string[];
    onLabelFilterChange?: (labels: string[]) => void;
    onCategoryFilterChange?: (category: NoteCategory | 'all') => void;
    onAssigneeFilterChange?: (assignees: string[]) => void;
    externalViewMode?: 'list' | 'calendar';
    onViewModeChange?: (viewMode: 'list' | 'calendar') => void;
    externalSelectedDate?: Date;
    onSelectedDateChange?: (date: Date | undefined) => void;
    // Sort configuration (from CommandPalette)
    externalSortConfig?: SortConfigType;
    onSortConfigChange?: (config: SortConfigType) => void;
    noteLabelsCache: Map<string, Label[]>;
    // Task status filter (from CommandPalette)
    externalTaskStatusFilter?: 'active' | 'completed' | 'deleted';
    onTaskStatusFilterChange?: (status: 'active' | 'completed' | 'deleted') => void;
    externalShowOverdueOnly?: boolean;
    onShowOverdueOnlyChange?: (show: boolean) => void;
}

export function useNoteFilters({
    notes,
    deletedNotes,
    externalLabelFilter,
    externalCategoryFilter,
    externalAssigneeFilter,
    onLabelFilterChange,
    onCategoryFilterChange,
    onAssigneeFilterChange,
    externalViewMode,
    onViewModeChange,
    externalSelectedDate,
    onSelectedDateChange,
    externalSortConfig,
    onSortConfigChange,
    noteLabelsCache,
    externalTaskStatusFilter,
    onTaskStatusFilterChange,
    externalShowOverdueOnly,
    onShowOverdueOnlyChange,
}: UseNoteFiltersProps) {
    const { contacts } = useContacts();

    // Internal State
    const [internalLabelFilter, setInternalLabelFilter] = useState<string[]>([]);
    const [internalCategoryFilter, setInternalCategoryFilter] = useState<NoteCategory | 'all'>('all');
    const [internalAssigneeFilter, setInternalAssigneeFilter] = useState<string[]>([]);
    const [internalCalendarSelectedDate, setInternalCalendarSelectedDate] = useState<Date | undefined>(new Date());

    // Settings / View Mode (Assuming settings are passed or managed internally if simple)
    // For now, we'll manage viewMode here if not external
    const [internalViewMode, setInternalViewMode] = useState<'list' | 'calendar'>('list');

    const [searchQuery, setSearchQuery] = useState('');
    const [internalTaskStatusFilter, setInternalTaskStatusFilter] = useState<'active' | 'completed' | 'deleted'>('active');
    const [sortByDeadline, setSortByDeadline] = useState(false);
    const [sortByAssignee, setSortByAssignee] = useState(false);
    const [sortByCategory, setSortByCategory] = useState(false);
    const [internalSortConfig, setInternalSortConfig] = useState<SortConfigType>({
        deadline: null,
        assignee: null,
        category: null,
    });
    const [internalShowOverdueOnly, setInternalShowOverdueOnly] = useState(false);
    const [dateRangeFilter, setDateRangeFilter] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });


    // Derived State (combine external and internal)
    const labelFilter = externalLabelFilter ?? internalLabelFilter;
    const categoryFilter = externalCategoryFilter ?? internalCategoryFilter;
    const assigneeFilter = externalAssigneeFilter ?? internalAssigneeFilter;
    const viewMode = externalViewMode ?? internalViewMode;
    const calendarSelectedDate = externalSelectedDate ?? internalCalendarSelectedDate;
    const sortConfig = externalSortConfig ?? internalSortConfig;
    const taskStatusFilter = externalTaskStatusFilter ?? internalTaskStatusFilter;
    const showOverdueOnly = externalShowOverdueOnly ?? internalShowOverdueOnly;

    // Setters
    const setLabelFilter = (value: string[] | ((prev: string[]) => string[])) => {
        const newValue = typeof value === 'function' ? value(labelFilter) : value;
        if (onLabelFilterChange) {
            onLabelFilterChange(newValue);
        } else {
            setInternalLabelFilter(newValue);
        }
    };

    const setCategoryFilter = (value: NoteCategory | 'all') => {
        // Logic to toggle categories via hotkeys can be handled in the component or passed down
        if (onCategoryFilterChange) {
            onCategoryFilterChange(value);
        } else {
            setInternalCategoryFilter(value);
        }
    };

    const setAssigneeFilter = (value: string[] | ((prev: string[]) => string[])) => {
        const newValue = typeof value === 'function' ? value(assigneeFilter) : value;
        if (onAssigneeFilterChange) {
            onAssigneeFilterChange(newValue);
        } else {
            setInternalAssigneeFilter(newValue);
        }
    };

    const setViewMode = (value: 'list' | 'calendar') => {
        if (onViewModeChange) {
            onViewModeChange(value);
        } else {
            setInternalViewMode(value);
        }
    };

    const setCalendarSelectedDate = (date: Date | undefined) => {
        if (onSelectedDateChange) {
            onSelectedDateChange(date);
        } else {
            setInternalCalendarSelectedDate(date);
        }
    };

    const setSortConfig = (value: SortConfigType) => {
        if (onSortConfigChange) {
            onSortConfigChange(value);
        } else {
            setInternalSortConfig(value);
        }
    };

    const setTaskStatusFilter = (value: 'active' | 'completed' | 'deleted') => {
        if (onTaskStatusFilterChange) {
            onTaskStatusFilterChange(value);
        } else {
            setInternalTaskStatusFilter(value);
        }
    };

    const setShowOverdueOnly = (value: boolean) => {
        if (onShowOverdueOnlyChange) {
            onShowOverdueOnlyChange(value);
        } else {
            setInternalShowOverdueOnly(value);
        }
    };


    // PERFORMANCE: Cache searchQuery lowercase to avoid repeated toLowerCase() calls
    const searchQueryLower = useMemo(() => searchQuery.toLowerCase(), [searchQuery]);

    // PERFORMANCE: Pre-compute calendar date key once instead of 3 times
    const calendarDateKey = useMemo(() => {
        if (!calendarSelectedDate) return null;
        return formatLocalDate(calendarSelectedDate);
    }, [calendarSelectedDate]);

    // PERFORMANCE: Pre-compute assignee names
    const assigneeIdsKey = notes.map(n => n.assignee_id ?? '').join(',');
    const assigneeNamesCache = useMemo(() => {
        const cache = new Map<string, string | null>();
        
        // Build contact map for faster lookup
        const contactMap = new Map<string, Contact>();
        contacts.forEach(c => contactMap.set(c.id, c));
        
        for (const note of notes) {
            if (note.assignee_id) {
                const contact = contactMap.get(note.assignee_id);
                cache.set(note.id, contact ? getInitials(contact.name, contact.lastname) : null);
            } else {
                cache.set(note.id, null);
            }
        }
        return cache;
    }, [notes, assigneeIdsKey, contacts]);


    // Filter Logic
    const baseFilteredNotes = useMemo(() => notes.filter((note) => {
        if (note.pinned) {
            if (!searchQuery.trim()) {
                if (categoryFilter === 'all' && note.category === 'notes') return false;
                if (categoryFilter !== 'all' && note.category !== categoryFilter) return false;
                return true;
            }
            // Cuando hay búsqueda, buscar en el contenido sin filtrar por categoría
            const titleMatch = note.content.toLowerCase().includes(searchQueryLower);
            const descriptionMatch = note.description?.toLowerCase().includes(searchQueryLower) ?? false;
            return titleMatch || descriptionMatch;
        }

        // Solo aplicar filtro de categoría si NO hay búsqueda de texto
        // (cuando hay búsqueda, queremos buscar en todas las categorías incluyendo notas)
        if (!searchQuery.trim()) {
            if (categoryFilter === 'all') {
                if (note.category === 'notes') return false;
            } else if (note.category !== categoryFilter) {
                return false;
            }
        }

        if (labelFilter.length > 0) {
            const noteLabelIds = (noteLabelsCache.get(note.id) ?? EMPTY_LABELS).map(l => l.id);
            const hasMatchingLabel = labelFilter.some(labelId => noteLabelIds.includes(labelId));
            if (!hasMatchingLabel) return false;
        }

        if (assigneeFilter.length > 0) {
            if (!note.assignee_id || !assigneeFilter.includes(note.assignee_id)) {
                return false;
            }
        }

        if (showOverdueOnly) {
            if (!note.deadline || note.category === 'meeting') return false;
            const isOverdue = parseLocalDate(note.deadline) < new Date() && !note.completed;
            if (!isOverdue) return false;
        }

        if (!searchQuery.trim() && note.category === 'meeting' && note.deadline && !note.completed) {
            const meetingDate = startOfDay(parseLocalDate(note.deadline));
            const today = startOfDay(new Date());
            if (meetingDate < today) return false;
        }

        if (dateRangeFilter.from || dateRangeFilter.to) {
            if (!note.deadline) return false;
            const noteDeadline = parseLocalDate(note.deadline);
            if (dateRangeFilter.from && noteDeadline < startOfDay(dateRangeFilter.from)) return false;
            if (dateRangeFilter.to && noteDeadline > endOfDay(dateRangeFilter.to)) return false;
        }

        if (!searchQuery.trim()) return true;
        const titleMatch = note.content.toLowerCase().includes(searchQueryLower);
        const descriptionMatch = note.description?.toLowerCase().includes(searchQueryLower) ?? false;
        return titleMatch || descriptionMatch;
    }), [notes, categoryFilter, labelFilter, assigneeFilter, showOverdueOnly, dateRangeFilter, searchQuery, searchQueryLower, noteLabelsCache]);


    // Active & Completed
    const activeNotes = useMemo(() => {
        const active = baseFilteredNotes.filter((note) => !note.completed);
        return sortNotes(active, sortConfig as NoteSortConfig, assigneeNamesCache);
    }, [baseFilteredNotes, sortConfig, assigneeNamesCache]);

    const completedNotes = useMemo(() => {
        const completed = baseFilteredNotes.filter((note) => note.completed);
        return sortCompletedNotes(completed);
    }, [baseFilteredNotes]);

    const filteredNotes = useMemo(() => [...activeNotes, ...completedNotes], [activeNotes, completedNotes]);
    const activeNotesRef = useRef(activeNotes);
    activeNotesRef.current = activeNotes;
    const filteredNotesRef = useRef(filteredNotes);

    // Calendar Logic
    const calendarFilteredNotes = useMemo(() => {
        if (!calendarDateKey) return [];
        return notes.filter((note) => {
            if (note.completed) return false;
            if (!note.deadline) return false;
            const noteDeadline = getLocalDateKey(note.deadline);
            if (noteDeadline !== calendarDateKey) return false;
            if (note.category !== 'todo' && note.category !== 'followup' && note.category !== 'meeting') return false;
            if (categoryFilter !== 'all' && note.category !== categoryFilter) return false;
            if (labelFilter.length > 0) {
                const noteLabelIds = (noteLabelsCache.get(note.id) ?? EMPTY_LABELS).map(l => l.id);
                if (!labelFilter.some(labelId => noteLabelIds.includes(labelId))) return false;
            }
            if (assigneeFilter.length > 0) {
                if (!note.assignee_id || !assigneeFilter.includes(note.assignee_id)) return false;
            }
            if (searchQuery.trim()) {
                const titleMatch = note.content.toLowerCase().includes(searchQueryLower);
                const descriptionMatch = note.description?.toLowerCase().includes(searchQueryLower) ?? false;
                if (!titleMatch && !descriptionMatch) return false;
            }
            return true;
        });
    }, [notes, calendarDateKey, categoryFilter, labelFilter, assigneeFilter, searchQuery, searchQueryLower, noteLabelsCache]);

    const calendarCompletedNotes = useMemo(() => {
        if (!calendarDateKey) return [];
        return notes.filter((note) => {
            if (!note.completed) return false;
            if (!note.deadline) return false;
            const noteDeadline = getLocalDateKey(note.deadline);
            if (noteDeadline !== calendarDateKey) return false;
            if (note.category !== 'todo' && note.category !== 'followup' && note.category !== 'meeting') return false;
            if (categoryFilter !== 'all' && note.category !== categoryFilter) return false;
            if (labelFilter.length > 0) {
                const noteLabelIds = (noteLabelsCache.get(note.id) ?? EMPTY_LABELS).map(l => l.id);
                if (!labelFilter.some(labelId => noteLabelIds.includes(labelId))) return false;
            }
            if (assigneeFilter.length > 0) {
                if (!note.assignee_id || !assigneeFilter.includes(note.assignee_id)) return false;
            }
            if (searchQuery.trim()) {
                const titleMatch = note.content.toLowerCase().includes(searchQueryLower);
                const descriptionMatch = note.description?.toLowerCase().includes(searchQueryLower) ?? false;
                if (!titleMatch && !descriptionMatch) return false;
            }
            return true;
        }).sort((a, b) => {
            const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0;
            const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0;
            return bTime - aTime;
        });
    }, [notes, calendarDateKey, categoryFilter, labelFilter, assigneeFilter, searchQuery, searchQueryLower, noteLabelsCache]);

    const calendarDeletedNotes = useMemo(() => {
        if (!calendarDateKey) return [];
        return deletedNotes.filter((note) => {
            if (!note.deadline) return false;
            const noteDeadline = getLocalDateKey(note.deadline);
            if (noteDeadline !== calendarDateKey) return false;
            if (note.category !== 'todo' && note.category !== 'followup' && note.category !== 'meeting') return false;
            if (categoryFilter !== 'all' && note.category !== categoryFilter) return false;
            if (labelFilter.length > 0) {
                const noteLabelIds = (noteLabelsCache.get(note.id) ?? EMPTY_LABELS).map(l => l.id);
                if (!labelFilter.some(labelId => noteLabelIds.includes(labelId))) return false;
            }
            if (assigneeFilter.length > 0) {
                if (!note.assignee_id || !assigneeFilter.includes(note.assignee_id)) return false;
            }
            if (searchQuery.trim()) {
                const titleMatch = note.content.toLowerCase().includes(searchQueryLower);
                const descriptionMatch = note.description?.toLowerCase().includes(searchQueryLower) ?? false;
                if (!titleMatch && !descriptionMatch) return false;
            }
            return true;
        });
    }, [deletedNotes, calendarDateKey, categoryFilter, labelFilter, assigneeFilter, searchQuery, searchQueryLower, noteLabelsCache]);

    filteredNotesRef.current = viewMode === 'calendar'
        ? [...calendarFilteredNotes, ...calendarCompletedNotes]
        : filteredNotes;

    const notesMatchingFilters = useMemo(() => {
        if (labelFilter.length === 0 && assigneeFilter.length === 0 && !showOverdueOnly) {
            return activeNotes.length;
        }
        return activeNotes.filter((note) => {
            if (note.pinned) {
                if (labelFilter.length > 0) {
                    const noteLabelIds = (noteLabelsCache.get(note.id) ?? []).map(l => l.id);
                    const hasMatchingLabel = labelFilter.some(labelId => noteLabelIds.includes(labelId));
                    if (!hasMatchingLabel) return false;
                }
                if (assigneeFilter.length > 0) {
                    if (!note.assignee_id || !assigneeFilter.includes(note.assignee_id)) {
                        return false;
                    }
                }
                if (showOverdueOnly) {
                    if (!note.deadline || note.category === 'meeting') return false;
                    const isOverdue = parseLocalDate(note.deadline) < new Date() && !note.completed;
                    if (!isOverdue) return false;
                }
            }
            return true;
        }).length;
    }, [activeNotes, labelFilter, assigneeFilter, showOverdueOnly, noteLabelsCache]);


    return useMemo(() => ({
        // State
        searchQuery,
        setSearchQuery,
        taskStatusFilter,
        setTaskStatusFilter,
        sortByDeadline,
        setSortByDeadline,
        sortByAssignee,
        setSortByAssignee,
        sortByCategory,
        setSortByCategory,
        sortConfig,
        setSortConfig,
        showOverdueOnly,
        setShowOverdueOnly,
        dateRangeFilter,
        setDateRangeFilter,

        // Filter values (derived)
        labelFilter,
        categoryFilter,
        assigneeFilter,
        viewMode,
        calendarSelectedDate,

        // Filter Setters
        setLabelFilter,
        setCategoryFilter,
        setAssigneeFilter,
        setViewMode,
        setCalendarSelectedDate,

        // Computed Lists
        activeNotes,
        completedNotes,
        filteredNotes,
        calendarFilteredNotes,
        calendarCompletedNotes,
        calendarDeletedNotes,
        notesMatchingFilters,

        // Refs
        activeNotesRef,
        filteredNotesRef,

        // Helper
        assigneeNamesCache
    }), [
        searchQuery, taskStatusFilter, sortByDeadline, sortByAssignee, sortByCategory, sortConfig, showOverdueOnly, dateRangeFilter,
        labelFilter, categoryFilter, assigneeFilter, viewMode, calendarSelectedDate,
        activeNotes, completedNotes, filteredNotes, calendarFilteredNotes, calendarCompletedNotes, calendarDeletedNotes, notesMatchingFilters,
        assigneeNamesCache,
        setLabelFilter, setCategoryFilter, setAssigneeFilter, setViewMode, setCalendarSelectedDate,
        setTaskStatusFilter, setShowOverdueOnly, setSortConfig
    ]);
}
