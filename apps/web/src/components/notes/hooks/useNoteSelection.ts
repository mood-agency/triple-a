import { useRef, useEffect, useCallback, useMemo } from 'react';
import { useActorRef, useSelector } from '@xstate/react';
import type { Note, NoteCategory } from '@/types/note';
import type { BlockNoteEditorHandle } from '@/components/ui/BlockNoteEditor';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useNoteFieldsStore } from '@/stores/useNoteFieldsStore';
import { selectionMachine, type FocusTarget } from './selectionMachine';

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
    // --- DOM Refs (kept outside machine — not serializable state) ---
    const descriptionRef = useRef<BlockNoteEditorHandle>(null);
    const descriptionCaretPositionRef = useRef<number | null>(null);

    // --- Zustand store selectors (shared across components, not owned by machine) ---
    const noteId = selectedNote?.id ?? null;
    const titleValue = useNoteFieldsStore(s => noteId ? s.notes[noteId]?.titleValue ?? '' : '');
    const descriptionValue = useNoteFieldsStore(s => noteId ? s.notes[noteId]?.descriptionValue ?? '' : '');
    const storeSetTitleValue = useNoteFieldsStore(s => s.setTitleValue);
    const storeSetDescriptionValue = useNoteFieldsStore(s => s.setDescriptionValue);
    const selectNoteInStore = useNoteFieldsStore(s => s.selectNote);

    // --- Unfocused save timer (side effect, kept outside machine) ---
    const hasLocalChangeRef = useRef(false);
    const unfocusedSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Stable refs for current props (used in machine actions via .provide())
    const selectedNoteRef = useRef(selectedNote);
    selectedNoteRef.current = selectedNote;
    const onEditRef = useRef(onEdit);
    onEditRef.current = onEdit;

    // --- XState Actor ---
    const actorRef = useActorRef(
        selectionMachine.provide({
            actions: {
                syncStoreOnNoteChange: ({ context }) => {
                    hasLocalChangeRef.current = false;
                    selectNoteInStore(context.note ? {
                        id: context.note.id,
                        content: context.note.content,
                        description: context.note.description,
                        deadline: context.note.deadline,
                    } : null);
                },
                clearUnfocusedSaveTimer: () => {
                    if (unfocusedSaveTimerRef.current) {
                        clearTimeout(unfocusedSaveTimerRef.current);
                        unfocusedSaveTimerRef.current = null;
                    }
                },
            },
        }),
        { input: { note: selectedNote } }
    );

    // --- Fine-grained selectors from machine ---
    const focusTarget = useSelector(actorRef, s => s.context.focusTarget);
    const desiredColumn = useSelector(actorRef, s => s.context.desiredColumn);
    const showDescriptionPanel = useSelector(actorRef, s => s.context.showDescriptionPanel);
    const isDescriptionFocused = useSelector(actorRef, s => s.matches('editingDescription'));

    // --- Bridge: selectedNote prop → machine events ---

    // Track previous note ID to detect changes
    const prevNoteIdRef = useRef<string | null>(null);

    useEffect(() => {
        const newId = selectedNote?.id ?? null;
        const idChanged = prevNoteIdRef.current !== newId;
        prevNoteIdRef.current = newId;

        if (idChanged) {
            if (selectedNote) {
                actorRef.send({ type: 'NOTE_SELECTED', note: selectedNote });
            } else {
                actorRef.send({ type: 'NOTE_DESELECTED' });
            }
        }
    }, [selectedNote?.id, actorRef]);

    // Bridge: selectedNote content/description changes → NOTE_CHANGED
    useEffect(() => {
        if (selectedNote && prevNoteIdRef.current === selectedNote.id) {
            actorRef.send({ type: 'NOTE_CHANGED', note: selectedNote });
        }
    }, [selectedNote?.content, selectedNote?.description, actorRef]);

    // --- Setter wrappers (same API as before, sending machine events internally) ---

    const setTitleValue = useCallback((value: string) => {
        const id = selectedNoteRef.current?.id;
        if (id) storeSetTitleValue(id, value);
    }, [storeSetTitleValue]);

    const setDescriptionValue = useCallback((value: string) => {
        const note = selectedNoteRef.current;
        if (!note) return;
        hasLocalChangeRef.current = true;
        storeSetDescriptionValue(note.id, value);

        // If editor is not focused (e.g., checkbox click), save after a short debounce
        const snapshot = actorRef.getSnapshot();
        if (!snapshot.matches('editingDescription') && note && onEditRef.current) {
            if (unfocusedSaveTimerRef.current) {
                clearTimeout(unfocusedSaveTimerRef.current);
            }
            unfocusedSaveTimerRef.current = setTimeout(() => {
                const currentNote = selectedNoteRef.current;
                if (currentNote && onEditRef.current) {
                    onEditRef.current(currentNote.id, currentNote.content, currentNote.category, value || null);
                }
                unfocusedSaveTimerRef.current = null;
            }, 300);
        }
    }, [storeSetDescriptionValue, actorRef]);

    const setFocusTarget = useCallback((target: FocusTarget) => {
        if (target === 'title') {
            // Use current desiredColumn from context
            const col = actorRef.getSnapshot().context.desiredColumn;
            actorRef.send({ type: 'FOCUS_TITLE', column: col });
        } else if (target === 'description-start') {
            actorRef.send({ type: 'TAB_PRESSED', desiredColumn: actorRef.getSnapshot().context.desiredColumn });
        } else if (target === null) {
            actorRef.send({ type: 'TITLE_FOCUSED' });
        }
        // 'description-end' is only used internally via focus target effect
    }, [actorRef]);

    const setDesiredColumn = useCallback((column: number) => {
        actorRef.send({ type: 'SET_DESIRED_COLUMN', column });
    }, [actorRef]);

    const setIsDescriptionFocused = useCallback((focused: boolean) => {
        if (focused) {
            actorRef.send({ type: 'DESCRIPTION_FOCUSED' });
        } else {
            actorRef.send({ type: 'DESCRIPTION_BLURRED' });
        }
    }, [actorRef]);

    const setShowDescriptionPanel = useCallback((show: boolean) => {
        if (!show) {
            actorRef.send({ type: 'ESCAPE_PRESSED' });
        }
        // show=true is handled via handleNavigateToDescription (TAB_PRESSED)
    }, [actorRef]);

    // --- Auto-save for description while editing (when focused) ---
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

    // --- Cleanup unfocused save timer on unmount ---
    useEffect(() => {
        return () => {
            if (unfocusedSaveTimerRef.current) {
                clearTimeout(unfocusedSaveTimerRef.current);
            }
        };
    }, []);

    // --- Handle Focus Target (DOM side-effect — reads machine context) ---
    useEffect(() => {
        if (!focusTarget || !selectedNote) return;

        if (focusTarget === 'description-start' || focusTarget === 'description-end') {
            setTimeout(() => {
                descriptionRef.current?.focus();
                if (descriptionRef.current) {
                    const value = descriptionValue;
                    if (focusTarget === 'description-start') {
                        const firstLineLength = value.indexOf('\n') === -1 ? value.length : value.indexOf('\n');
                        const pos = Math.min(desiredColumn, firstLineLength);
                        descriptionRef.current.setCursorPosition(pos);
                    } else {
                        const lines = value.split('\n');
                        const lastLineLength = lines[lines.length - 1].length;
                        const lastLineStart = value.length - lastLineLength;
                        const pos = lastLineStart + Math.min(desiredColumn, lastLineLength);
                        descriptionRef.current.setCursorPosition(pos);
                    }
                }
                // Clear focusTarget after applying focus
                actorRef.send({ type: 'CLEAR_FOCUS_TARGET' });
            }, 0);
        }
        // 'title' is handled via prop shouldFocusTitle in NoteRow
    }, [focusTarget, selectedNote?.id, desiredColumn, descriptionValue, actorRef]);

    // --- Stable callbacks ---

    const handleTitleFocused = useCallback(() => {
        actorRef.send({ type: 'TITLE_FOCUSED' });
    }, [actorRef]);

    const handleNavigateToDescription = useCallback(() => {
        actorRef.send({ type: 'TAB_PRESSED', desiredColumn: 0 });
    }, [actorRef]);

    // Pure helper (no state dependency)
    function getColumnPosition(text: string, cursorPos: number): number {
        const textBeforeCursor = text.substring(0, cursorPos);
        const lastNewline = textBeforeCursor.lastIndexOf('\n');
        return lastNewline === -1 ? cursorPos : cursorPos - lastNewline - 1;
    }

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

    // --- Return same shape as before ---
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
        flushDescriptionAutoSave: descriptionAutoSave.handleBlur,
    }), [
        focusTarget, desiredColumn, descriptionValue, setDescriptionValue, titleValue, setTitleValue,
        isDescriptionFocused, showDescriptionPanel,
        setFocusTarget, setDesiredColumn, setIsDescriptionFocused, setShowDescriptionPanel,
        handleTitleFocused, handleNavigateToDescription, restoreDescriptionCaret, descriptionAutoSave.handleBlur,
    ]);
}
