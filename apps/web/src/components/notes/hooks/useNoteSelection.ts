import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { Note, NoteCategory } from '@/types/note';
import type { BlockNoteEditorHandle } from '@/components/ui/BlockNoteEditor';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useNoteFieldsStore } from '@/stores/useNoteFieldsStore';

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
    const [isDescriptionFocused, setIsDescriptionFocused] = useState(false);
    const [showDescriptionPanel, setShowDescriptionPanel] = useState(false);

    // Read from Zustand store — keyed by note ID
    const noteId = selectedNote?.id ?? null;
    const titleValue = useNoteFieldsStore(s => noteId ? s.notes[noteId]?.titleValue ?? '' : '');
    const descriptionValue = useNoteFieldsStore(s => noteId ? s.notes[noteId]?.descriptionValue ?? '' : '');
    const storeSetTitleValue = useNoteFieldsStore(s => s.setTitleValue);
    const storeSetDescriptionValue = useNoteFieldsStore(s => s.setDescriptionValue);
    const selectNote = useNoteFieldsStore(s => s.selectNote);

    // Track if there's a pending local change (e.g., checkbox click in BlockNote)
    const hasLocalChangeRef = useRef(false);
    // Timer for debounced save when editor is not focused
    const unfocusedSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Track the note ID to detect when we switch to a different note
    const selectedNoteIdRef = useRef<string | null>(null);

    // Bound setters that use the current noteId via ref (stable references)
    const setTitleValue = useCallback((value: string) => {
        const id = selectedNoteIdRef.current;
        if (id) storeSetTitleValue(id, value);
    }, [storeSetTitleValue]);

    // Wrapper to track local changes and trigger save when not focused
    const setDescriptionValue = useCallback((value: string) => {
        const id = selectedNoteIdRef.current;
        if (!id) return;
        hasLocalChangeRef.current = true;
        storeSetDescriptionValue(id, value);

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
    }, [isDescriptionFocused, selectedNote, onEdit, storeSetDescriptionValue]);

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

    // Sync store when switching notes
    useEffect(() => {
        const newNoteId = selectedNote?.id ?? null;
        const noteIdChanged = selectedNoteIdRef.current !== newNoteId;
        selectedNoteIdRef.current = newNoteId;

        if (noteIdChanged) {
            // Switching to a different note - reset store with new note data
            if (unfocusedSaveTimerRef.current) {
                clearTimeout(unfocusedSaveTimerRef.current);
                unfocusedSaveTimerRef.current = null;
            }
            hasLocalChangeRef.current = false;
            selectNote(selectedNote ? {
                id: selectedNote.id,
                content: selectedNote.content,
                description: selectedNote.description,
                deadline: selectedNote.deadline,
            } : null);
            setShowDescriptionPanel(false);
        }
        // NOTE: We removed the automatic sync of titleValue when content changes for the same note.
        // This was causing issues when Tab navigation sets titleValue from the event
        // (with the new content) but then this effect overwrote it with the old selectedNote.content
        // before the save completed. Now titleValue is only set via:
        // 1. Note ID change (above via selectNote)
        // 2. Event handler in NotesWorkspace (editor:navigateToDescription)
        // 3. Manual calls to setTitleValue
    }, [selectedNote?.id, selectedNote?.description, selectedNote?.content, selectNote]);

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
        focusTarget, desiredColumn, descriptionValue, setDescriptionValue, titleValue, setTitleValue, isDescriptionFocused, showDescriptionPanel,
        handleTitleFocused, handleNavigateToDescription, restoreDescriptionCaret, descriptionAutoSave.handleBlur
    ]);
}
