import { useCallback } from 'react';
import type { Note, NoteCategory } from '@/types/note';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface UseNoteOperationsProps {
    filteredNotesRef: React.MutableRefObject<Note[]>;
    activeNotesRef: React.MutableRefObject<Note[]>;
    onDelete: (id: string) => void;
    onRestore: (note: Note) => void;
    onToggleCompleted: (id: string, completed: boolean) => void;
    onSelectNote: (note: Note | null) => void;
    onNavigateToEditor?: (column: number) => void;
    setDesiredColumn: (column: number) => void;
    setFocusTarget: (target: 'title' | 'description-start' | 'description-end' | null) => void;
    onCreateNoteAfter?: (afterNoteId: string, category: NoteCategory, deadline?: string | null, labelIds?: string[]) => Promise<Note>;
    viewMode: 'list' | 'calendar';
    calendarSelectedDate?: Date;
    labelFilter: string[];
}

export function useNoteOperations({
    filteredNotesRef,
    activeNotesRef,
    onDelete,
    onRestore,
    onToggleCompleted,
    onSelectNote,
    onNavigateToEditor,
    setDesiredColumn,
    setFocusTarget,
    onCreateNoteAfter,
    viewMode,
    calendarSelectedDate,
    labelFilter
}: UseNoteOperationsProps) {
    const { t } = useTranslation();

    const handleDeleteWithToast = useCallback((note: Note) => {
        const currentFilteredNotes = filteredNotesRef.current;
        const currentIndex = currentFilteredNotes.findIndex((n) => n.id === note.id);

        // Determine where to navigate after deletion
        let targetNote: Note | null = null;
        let shouldNavigateToEditor = false;

        if (currentFilteredNotes.length === 1) {
            // Last task, navigate to editor
            shouldNavigateToEditor = true;
        } else if (currentIndex > 0) {
            // Has task above, navigate to it
            targetNote = currentFilteredNotes[currentIndex - 1];
        } else {
            // First task (no task above), navigate to task below
            targetNote = currentFilteredNotes[currentIndex + 1];
        }

        // Delete first, then navigate
        onDelete(note.id);

        // Navigate after deletion
        if (shouldNavigateToEditor) {
            onSelectNote(null);
            onNavigateToEditor?.(0);
        } else if (targetNote) {
            onSelectNote(targetNote);
            // Position caret at end of text when navigating up, start when navigating down
            setDesiredColumn(currentIndex > 0 ? targetNote.content.length : 0);
            setFocusTarget('title');
        }

        toast(t('taskDeleted'), {
            action: {
                label: t('undo'),
                onClick: () => onRestore(note),
            },
        });
    }, [onDelete, onSelectNote, onNavigateToEditor, onRestore, t, filteredNotesRef, setDesiredColumn, setFocusTarget]);

    const handleToggleCompletedWithNavigation = useCallback((noteId: string, completed: boolean) => {
        const currentActiveNotes = activeNotesRef.current;
        // Find current position in activeNotes (only active notes matter for navigation)
        const currentIndex = currentActiveNotes.findIndex((n) => n.id === noteId);

        // Only navigate when completing a task (not when uncompleting)
        if (completed && currentIndex !== -1) {
            // Determine where to navigate after completion
            let targetNote: Note | null = null;

            if (currentActiveNotes.length === 1) {
                // Last active task, deselect (show default description area)
                targetNote = null;
            } else if (currentIndex < currentActiveNotes.length - 1) {
                // Has task below, navigate to it
                targetNote = currentActiveNotes[currentIndex + 1];
            } else if (currentIndex > 0) {
                // Last task in list but has task above, navigate to it
                targetNote = currentActiveNotes[currentIndex - 1];
            }

            // Toggle completion
            onToggleCompleted(noteId, completed);

            // Show toast for completion
            toast.success(t('taskCompleted'));

            // Navigate to adjacent task or deselect
            onSelectNote(targetNote);
            if (targetNote) {
                setDesiredColumn(0);
                setFocusTarget('title');
            }
        } else {
            // Just toggle without navigation (uncompleting a task)
            onToggleCompleted(noteId, completed);

            // Show toast for reopening
            if (!completed) {
                toast(t('taskReopened'));
            }
        }
    }, [onToggleCompleted, onSelectNote, t, activeNotesRef, setDesiredColumn, setFocusTarget]);

    const handleCreateNoteAfterById = useCallback((noteId: string) => {
        if (!onCreateNoteAfter) return;
        const currentFilteredNotes = filteredNotesRef.current;
        const afterNote = currentFilteredNotes.find((n) => n.id === noteId);
        if (!afterNote) return;

        // In calendar mode, inherit the deadline from the note we're creating after
        let deadline: string | undefined;
        if (viewMode === 'calendar' && calendarSelectedDate) {
            if (afterNote.deadline) {
                // Use the original note's deadline (preserves time component)
                deadline = afterNote.deadline;
            } else {
                // Fallback to just the date if no deadline on original note
                const year = calendarSelectedDate.getFullYear();
                const month = String(calendarSelectedDate.getMonth() + 1).padStart(2, '0');
                const day = String(calendarSelectedDate.getDate()).padStart(2, '0');
                deadline = `${year}-${month}-${day}`;
            }
        }

        // Pass label filter so new task is visible with current filters
        const result = onCreateNoteAfter(noteId, afterNote.category, deadline, labelFilter);
        // Handle both Promise and synchronous returns
        Promise.resolve(result).then((newNoteOrId) => {
            if (newNoteOrId) {
                const newNote: Note = typeof newNoteOrId === 'string'
                    ? { id: newNoteOrId } as unknown as Note
                    : newNoteOrId;
                onSelectNote(newNote);
                setDesiredColumn(0);
                setFocusTarget('title');
            }
        });
    }, [onCreateNoteAfter, onSelectNote, viewMode, calendarSelectedDate, labelFilter, filteredNotesRef, setDesiredColumn, setFocusTarget]);

    // Handler to create a task at a specific hour in timeline view
    const handleCreateTaskAtTime = useCallback((hour: number) => {
        if (!onCreateNoteAfter || !calendarSelectedDate) return;

        // Build deadline with date + time in local timezone
        const year = calendarSelectedDate.getFullYear();
        const month = String(calendarSelectedDate.getMonth() + 1).padStart(2, '0');
        const day = String(calendarSelectedDate.getDate()).padStart(2, '0');
        const hourStr = String(hour).padStart(2, '0');
        const deadline = `${year}-${month}-${day}T${hourStr}:00`;

        // Get last note in the current filtered list to use as reference, or use empty string for first note
        const currentFilteredNotes = filteredNotesRef.current;
        const lastNote = currentFilteredNotes[currentFilteredNotes.length - 1];
        const afterNoteId = lastNote?.id ?? '';

        // Create task with 'todo' category and the specific time deadline
        const result = onCreateNoteAfter(afterNoteId, 'todo', deadline, labelFilter);
        Promise.resolve(result).then((newNoteOrId) => {
            if (newNoteOrId) {
                const newNote: Note = typeof newNoteOrId === 'string'
                    ? { id: newNoteOrId } as unknown as Note
                    : newNoteOrId;
                onSelectNote(newNote);
                setDesiredColumn(0);
                setFocusTarget('title');
            }
        });
    }, [onCreateNoteAfter, onSelectNote, calendarSelectedDate, labelFilter, filteredNotesRef, setDesiredColumn, setFocusTarget]);

    const handleNavigateDownById = useCallback((noteId: string, column: number): boolean => {
        const currentFilteredNotes = filteredNotesRef.current;
        const idx = currentFilteredNotes.findIndex((n) => n.id === noteId);
        if (idx < currentFilteredNotes.length - 1) {
            setDesiredColumn(column);
            onSelectNote(currentFilteredNotes[idx + 1]);
            setFocusTarget('title');
            return true;
        }
        return false;
    }, [onSelectNote, filteredNotesRef, setDesiredColumn, setFocusTarget]);

    const handleNavigateUpById = useCallback((noteId: string, column: number): boolean => {
        const currentFilteredNotes = filteredNotesRef.current;
        const idx = currentFilteredNotes.findIndex((n) => n.id === noteId);
        if (idx > 0) {
            setDesiredColumn(column);
            onSelectNote(currentFilteredNotes[idx - 1]);
            setFocusTarget('title');
            return true;
        } else if (idx === 0) {
            return false;
        }
        return false;
    }, [onSelectNote, filteredNotesRef, setDesiredColumn, setFocusTarget]);


    return {
        handleDeleteWithToast,
        handleToggleCompletedWithNavigation,
        handleCreateNoteAfterById,
        handleCreateTaskAtTime,
        handleNavigateDownById,
        handleNavigateUpById
    };
}
