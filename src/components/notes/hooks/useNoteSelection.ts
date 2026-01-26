import { useState, useRef, useEffect, useCallback } from 'react';
import type { Note } from '@/types/note';
import type { EditableDescriptionHandle } from '@/components/ui/EditableDescription';

type FocusTarget = 'title' | 'description-start' | 'description-end' | null;

interface UseNoteSelectionProps {
    selectedNote: Note | null;
}

export function useNoteSelection({
    selectedNote,
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

    // Track the note ID to detect when we switch to a different note
    const selectedNoteIdRef = useRef<string | null>(null);

    // Update description and title values when selected note changes
    useEffect(() => {
        const newNoteId = selectedNote?.id ?? null;
        const noteIdChanged = selectedNoteIdRef.current !== newNoteId;
        selectedNoteIdRef.current = newNoteId;

        setDescriptionValue(selectedNote?.description || '');
        setTitleValue(selectedNote?.content || '');

        // Only close panel if we switched to a different note (or null)
        // This prevents closing when the same note is updated (e.g., deadline change)
        if (noteIdChanged) {
            setShowDescriptionPanel(false);
        }
    }, [selectedNote]);

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
    }, [focusTarget, selectedNote, desiredColumn, descriptionValue]);

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

    return {
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
        // Refs exposed for usage in other hooks
    };
}
