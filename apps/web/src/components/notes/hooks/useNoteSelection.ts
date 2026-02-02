import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { Note, NoteCategory } from '@/types/note';
import type { BlockNoteEditorHandle } from '@/components/ui/BlockNoteEditor';
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
    const descriptionRef = useRef<BlockNoteEditorHandle>(null);
    const descriptionCaretPositionRef = useRef<number | null>(null);

    const [focusTarget, setFocusTarget] = useState<FocusTarget>(null);
    const focusTargetRef = useRef<FocusTarget>(null);
    focusTargetRef.current = focusTarget;

    const [desiredColumn, setDesiredColumn] = useState<number>(0);
    const [descriptionValue, setDescriptionValueInternal] = useState('');
    const [titleValue, setTitleValue] = useState('');
    const [isDescriptionFocused, setIsDescriptionFocused] = useState(false);
    const [showDescriptionPanel, setShowDescriptionPanel] = useState(false);

    // Track if there's a pending local change (e.g., checkbox click in BlockNote)
    const hasLocalChangeRef = useRef(false);
    // Timer for debounced save when editor is not focused
    const unfocusedSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Wrapper to track local changes and trigger save when not focused
    const setDescriptionValue = useCallback((value: string) => {
        hasLocalChangeRef.current = true;
        setDescriptionValueInternal(value);

        // If editor is not focused (e.g., checkbox click), save after a short debounce
        if (!isDescriptionFocused && selectedNote && onEdit) {
            // Clear previous timer
            if (unfocusedSaveTimerRef.current) {
                clearTimeout(unfocusedSaveTimerRef.current);
            }
            // Save after 300ms debounce
            unfocusedSaveTimerRef.current = setTimeout(() => {
                onEdit(selectedNote.id, selectedNote.content, selectedNote.category, value || null);
                unfocusedSaveTimerRef.current = null;
            }, 300);
        }
    }, [isDescriptionFocused, selectedNote, onEdit]);

    // Auto-save for description while editing (when focused)
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


    // Cleanup unfocused save timer on unmount
    useEffect(() => {
        return () => {
            if (unfocusedSaveTimerRef.current) {
                clearTimeout(unfocusedSaveTimerRef.current);
            }
        };
    }, []);

    // Track the note ID to detect when we switch to a different note
    const selectedNoteIdRef = useRef<string | null>(null);

    // SIMPLE APPROACH: Only sync description when switching notes
    // Don't try to sync in real-time - just save periodically and load on note change
    useEffect(() => {
        const newNoteId = selectedNote?.id ?? null;
        const noteIdChanged = selectedNoteIdRef.current !== newNoteId;
        selectedNoteIdRef.current = newNoteId;

        if (noteIdChanged) {
            // Switching to a different note - load its description
            if (unfocusedSaveTimerRef.current) {
                clearTimeout(unfocusedSaveTimerRef.current);
                unfocusedSaveTimerRef.current = null;
            }
            hasLocalChangeRef.current = false;
            setDescriptionValueInternal(selectedNote?.description || '');
            setTitleValue(selectedNote?.content || '');
            setShowDescriptionPanel(false);
        } else {
            // Same note - only sync title (edited in a different component)
            // DON'T sync description - let the editor keep its local state
            setTitleValue(selectedNote?.content || '');
        }
    }, [selectedNote?.id, selectedNote?.description, selectedNote?.content]);

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
        focusTarget, desiredColumn, descriptionValue, setDescriptionValue, titleValue, isDescriptionFocused, showDescriptionPanel,
        handleTitleFocused, handleNavigateToDescription, restoreDescriptionCaret, descriptionAutoSave.handleBlur
    ]);
}
