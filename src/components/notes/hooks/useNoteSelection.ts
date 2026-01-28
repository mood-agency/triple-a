import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { Note, NoteCategory } from '@/types/note';
import type { EditableDescriptionHandle } from '@/components/ui/EditableDescription';
import { useAutoSave } from '@/hooks/useAutoSave';

type FocusTarget = 'title' | 'description-start' | 'description-end' | null;

interface UseNoteSelectionProps {
    selectedNote: Note | null;
    onEdit?: (id: string, content: string, category?: NoteCategory, description?: string | null) => void;
    autoSaveInterval?: number; // in seconds, 0 = disabled
}

export function useNoteSelection({
    selectedNote,
    onEdit,
    autoSaveInterval = 3,
}: UseNoteSelectionProps) {
    const descriptionRef = useRef<EditableDescriptionHandle>(null);
    const descriptionCaretPositionRef = useRef<number | null>(null);

    const [focusTarget, setFocusTarget] = useState<FocusTarget>(null);
    const focusTargetRef = useRef<FocusTarget>(null);
    focusTargetRef.current = focusTarget;

    const [desiredColumn, setDesiredColumn] = useState<number>(0);
    const [descriptionValue, setDescriptionValue] = useState('');
    const [titleValue, setTitleValue] = useState('');
    const [isDescriptionFocused, setIsDescriptionFocused] = useState(false);
    const [showDescriptionPanel, setShowDescriptionPanel] = useState(false);

    // Auto-save for description while editing
    const descriptionAutoSave = useAutoSave({
        value: descriptionValue,
        originalValue: selectedNote?.description || '',
        onSave: (value) => {
            console.log('[NoteSelection] Auto-save triggered for note:', selectedNote?.id);
            if (selectedNote && onEdit) {
                onEdit(selectedNote.id, selectedNote.content, selectedNote.category, value || null);
            }
        },
        debounceMs: autoSaveInterval * 1000,
        enabled: isDescriptionFocused && !!selectedNote && !!onEdit && autoSaveInterval > 0,
    });


    // Track the note ID to detect when we switch to a different note
    const selectedNoteIdRef = useRef<string | null>(null);

    // Update description and title values when selected note changes
    useEffect(() => {
        const newNoteId = selectedNote?.id ?? null;
        const noteIdChanged = selectedNoteIdRef.current !== newNoteId;
        selectedNoteIdRef.current = newNoteId;

        // Only sync values if note changed or we're not editing
        if (noteIdChanged) {
            setDescriptionValue(selectedNote?.description || '');
            setTitleValue(selectedNote?.content || '');
            // Don't auto-show description panel on click; user opens it with Tab
            setShowDescriptionPanel(false);
        } else if (!isDescriptionFocused) {
            // Sync description only if not focused (to avoid overwriting while typing)
            setDescriptionValue(selectedNote?.description || '');
            setTitleValue(selectedNote?.content || '');
        }
    }, [selectedNote?.id, selectedNote?.description, selectedNote?.content, isDescriptionFocused]);

    // Handle Focus Target
    useEffect(() => {
        if (!focusTarget || !selectedNote) return;

        if (focusTarget === 'description-start' || focusTarget === 'description-end') {
            setTimeout(() => {
                descriptionRef.current?.focus();
                if (descriptionRef.current) {
                    const value = descriptionValue;
                    if (focusTarget === 'description-start') {
                        // Use desired column on first line
                        const firstLineLength = value.indexOf('\n') === -1 ? value.length : value.indexOf('\n');
                        const pos = Math.min(desiredColumn, firstLineLength);
                        descriptionRef.current.setCursorPosition(pos);
                    } else {
                        // Use desired column on last line
                        const lines = value.split('\n');
                        const lastLineLength = lines[lines.length - 1].length;
                        const lastLineStart = value.length - lastLineLength;
                        const pos = lastLineStart + Math.min(desiredColumn, lastLineLength);
                        descriptionRef.current.setCursorPosition(pos);
                    }
                }
                setFocusTarget(null);
            }, 0);
        }
        // 'title' is handled via prop shouldFocusTitle in NoteRow (or MemoizedNoteRow)
    }, [focusTarget, selectedNote?.id, desiredColumn, descriptionValue]);

    const handleTitleFocused = useCallback(() => {
        if (focusTargetRef.current === 'title') {
            setFocusTarget(null);
        }
    }, []);

    // Selection Helpers
    const handleNavigateToDescription = useCallback(() => {
        setDesiredColumn(0);
        setFocusTarget('description-start');
        setShowDescriptionPanel(true);
    }, []);

    // Helper to get column position
    function getColumnPosition(text: string, cursorPos: number): number {
        const textBeforeCursor = text.substring(0, cursorPos);
        const lastNewline = textBeforeCursor.lastIndexOf('\n');
        return lastNewline === -1 ? cursorPos : cursorPos - lastNewline - 1;
    }

    // Focus restoration helpers (for dropdowns)
    const restoreDescriptionCaret = useCallback(() => {
        if (descriptionCaretPositionRef.current !== null) {
            const position = descriptionCaretPositionRef.current;
            descriptionCaretPositionRef.current = null;
            setTimeout(() => {
                descriptionRef.current?.focus();
                descriptionRef.current?.setCursorPosition(position);
            }, 0);
        }
    }, []);

    return useMemo(() => ({
        descriptionRef,
        descriptionCaretPositionRef,
        focusTarget,
        setFocusTarget,
        desiredColumn,
        setDesiredColumn,
        descriptionValue,
        setDescriptionValue,
        titleValue,
        setTitleValue,
        isDescriptionFocused,
        setIsDescriptionFocused,
        showDescriptionPanel,
        setShowDescriptionPanel,
        handleTitleFocused,
        handleNavigateToDescription,
        getColumnPosition,
        restoreDescriptionCaret,
        // Auto-save flush handler for description
        flushDescriptionAutoSave: descriptionAutoSave.handleBlur,
    }), [
        focusTarget, desiredColumn, descriptionValue, titleValue, isDescriptionFocused, showDescriptionPanel,
        handleTitleFocused, handleNavigateToDescription, restoreDescriptionCaret, descriptionAutoSave.handleBlur
    ]);
}
