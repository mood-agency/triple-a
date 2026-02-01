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
    // Track the last saved value to prevent race conditions with external sync
    const lastSavedValueRef = useRef<string | null>(null);
    // Timestamp of last save to prevent reverting recent changes
    const lastSaveTimestampRef = useRef<number>(0);

    // Wrapper to track local changes and trigger save when not focused
    const setDescriptionValue = useCallback((value: string) => {
        console.log('[NoteSelection] setDescriptionValue called:', {
            valueLength: value.length,
            isDescriptionFocused,
            hasLocalChange: hasLocalChangeRef.current,
            noteId: selectedNote?.id,
        });
        hasLocalChangeRef.current = true;
        setDescriptionValueInternal(value);

        // If editor is not focused (e.g., checkbox click), save after a short debounce
        if (!isDescriptionFocused && selectedNote && onEdit) {
            console.log('[NoteSelection] Scheduling unfocused save (500ms debounce)');
            // Clear previous timer
            if (unfocusedSaveTimerRef.current) {
                clearTimeout(unfocusedSaveTimerRef.current);
            }
            // Save after 500ms debounce
            unfocusedSaveTimerRef.current = setTimeout(() => {
                console.log('[NoteSelection] Unfocused save EXECUTING for note:', selectedNote?.id);
                lastSavedValueRef.current = value;
                lastSaveTimestampRef.current = Date.now();
                onEdit(selectedNote.id, selectedNote.content, selectedNote.category, value || null);
                unfocusedSaveTimerRef.current = null;
            }, 500);
        }
    }, [isDescriptionFocused, selectedNote, onEdit]);

    // Auto-save for description while editing (when focused)
    const descriptionAutoSave = useAutoSave({
        value: descriptionValue,
        originalValue: selectedNote?.description || '',
        onSave: (value) => {
            console.log('[NoteSelection] Auto-save triggered for note:', selectedNote?.id);
            if (selectedNote && onEdit) {
                lastSavedValueRef.current = value;
                lastSaveTimestampRef.current = Date.now();
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

    // Update description and title values when selected note changes
    useEffect(() => {
        const newNoteId = selectedNote?.id ?? null;
        const noteIdChanged = selectedNoteIdRef.current !== newNoteId;
        selectedNoteIdRef.current = newNoteId;

        // Only sync values if note changed or we're not editing
        if (noteIdChanged) {
            // Cancel any pending unfocused save and reset local change flag when switching notes
            if (unfocusedSaveTimerRef.current) {
                clearTimeout(unfocusedSaveTimerRef.current);
                unfocusedSaveTimerRef.current = null;
            }
            hasLocalChangeRef.current = false;
            lastSavedValueRef.current = null;
            lastSaveTimestampRef.current = 0;
            setDescriptionValueInternal(selectedNote?.description || '');
            setTitleValue(selectedNote?.content || '');
            // Don't auto-show description panel on click; user opens it with Tab
            setShowDescriptionPanel(false);
        } else {
            // Always sync title when it changes (it's edited in a different component)
            setTitleValue(selectedNote?.content || '');

            // Only sync description if:
            // 1. Not focused AND no pending local change
            // 2. AND not a stale update that reverts our recent save
            const externalDesc = selectedNote?.description || '';
            const timeSinceLastSave = Date.now() - lastSaveTimestampRef.current;
            const isStaleUpdate = timeSinceLastSave < 3000 &&
                lastSavedValueRef.current !== null &&
                externalDesc !== lastSavedValueRef.current &&
                descriptionValue === lastSavedValueRef.current;

            console.log('[NoteSelection] useEffect sync check:', {
                noteId: selectedNote?.id,
                isDescriptionFocused,
                hasLocalChange: hasLocalChangeRef.current,
                isStaleUpdate,
                timeSinceLastSave,
                lastSavedValueLength: lastSavedValueRef.current?.length ?? 'null',
                externalDescLength: externalDesc.length,
                descriptionValueLength: descriptionValue.length,
                externalDescPreview: externalDesc.substring(0, 100),
                descriptionValuePreview: descriptionValue.substring(0, 100),
            });

            if (!isDescriptionFocused && !hasLocalChangeRef.current && !isStaleUpdate) {
                console.log('[NoteSelection] ⚠️ SYNCING external description to local state');
                setDescriptionValueInternal(externalDesc);
            } else {
                console.log('[NoteSelection] ✓ NOT syncing (protected)', {
                    reason: isDescriptionFocused ? 'focused' : hasLocalChangeRef.current ? 'hasLocalChange' : 'isStaleUpdate'
                });
            }

            // Clear local change flag once the external value matches (save completed)
            if (hasLocalChangeRef.current && externalDesc === descriptionValue) {
                console.log('[NoteSelection] Clearing hasLocalChangeRef (external matches local)');
                hasLocalChangeRef.current = false;
            }
            // Clear lastSavedValue if external value now matches what we saved (sync complete)
            if (lastSavedValueRef.current !== null && externalDesc === lastSavedValueRef.current) {
                console.log('[NoteSelection] Clearing lastSavedValueRef (sync complete)');
                lastSavedValueRef.current = null;
            }
        }
    }, [selectedNote?.id, selectedNote?.description, selectedNote?.content, isDescriptionFocused, descriptionValue]);

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
