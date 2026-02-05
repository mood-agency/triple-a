import { useState, useRef, useEffect, useCallback } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { parseHashtags, extractHashtags, extractMentions } from '@/utils/hashtagParser';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useNoteFieldsStore } from '@/stores/useNoteFieldsStore';
import type { Note, NoteCategory, Label } from '@/types/note';
import type { Contact } from '@/types/contact';
import { getCursorPosition, getFontString } from '@/utils/cursorUtils';

/**
 * Check if content has hashtags or mentions that need to be parsed
 */
function hasUnparsedTags(content: string): boolean {
    return extractHashtags(content).length > 0 || extractMentions(content).length > 0;
}

interface UseNoteRowProps {
    note: Note;
    isSelected: boolean;
    onSelect: (noteId: string) => void;
    onEdit: (id: string, content: string, category?: NoteCategory, description?: string | null) => void;
    onDeleteWithToast: (note: Note, reason: string) => void;
    onToggleCompleted: (id: string, completed: boolean) => void;
    onCreateNoteAfter?: (noteId: string) => void;
    onNavigateDown: (noteId: string, column: number) => boolean;
    onNavigateUp: (noteId: string, column: number) => boolean;
    onNavigateToDescription: () => void;
    shouldFocusTitle: boolean;
    desiredColumn: number;
    onTitleFocused: () => void;
    labels?: Label[];
    allLabels?: Label[];
    contacts?: Contact[];
    onUpdateAssignee?: (noteId: string, assigneeId: string | null) => void;
    onAddAssignee?: (noteId: string, contactId: string) => void;
    onAddLabel?: (noteId: string, labelId: string) => void;
    onCreateLabelAndAdd?: (noteId: string, labelName: string) => void;
    isCommandPaletteOpen?: boolean;
    onContentChange?: (content: string) => void;
    autoSaveInterval?: number; // in seconds, 0 = disabled
}

export function useNoteRow({
    note,
    isSelected,
    onSelect,
    onEdit,
    onDeleteWithToast,
    onToggleCompleted,
    onCreateNoteAfter,
    onNavigateDown,
    onNavigateUp,
    onNavigateToDescription,
    shouldFocusTitle,
    desiredColumn,
    onTitleFocused,
    allLabels = [],
    contacts = [],
    onUpdateAssignee: _onUpdateAssignee,
    onAddAssignee,
    onAddLabel,
    onCreateLabelAndAdd,
    isCommandPaletteOpen,
    autoSaveInterval = 3,
}: UseNoteRowProps) {
    const { t } = useTranslation();
    // Read title from the store map by noteId — for sync with editor panel
    const storeTitleValue = useNoteFieldsStore(s => s.notes[note.id]?.titleValue);
    const storeSetTitleValue = useNoteFieldsStore(s => s.setTitleValue);

    // Start in editing mode for newly created empty notes to avoid a
    // span→input flash that briefly shows "Nueva tarea..." placeholder.
    const [isEditingContent, setIsEditingContent] = useState(isSelected && note.content === '');
    const [localContentValue, setLocalContentValue] = useState(note.content);

    // Use store value when available (note is selected/fixed in store), otherwise use local state
    const contentValue = storeTitleValue ?? localContentValue;
    const setContentValue = useCallback((value: string) => {
        setLocalContentValue(value);
        // Always try to update store — setTitleValue is a no-op if the note
        // isn't in the map, so no guard needed. Avoiding a storeTitleValue
        // guard prevents stale closure bugs (saveContentWithHashtagParsing
        // doesn't list setContentValue in its deps).
        storeSetTitleValue(note.id, value);
    }, [storeSetTitleValue, note.id]);

    // Dropdown states
    const [showLabelDropdown, setShowLabelDropdown] = useState(false);
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
    const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    // Animation state for task completion
    const [isCompleting, setIsCompleting] = useState(false);

    // Refs
    const rowRef = useRef<HTMLDivElement>(null);
    const contentInputRef = useRef<HTMLInputElement>(null);
    const clickXRef = useRef<number | null>(null);
    const focusFromNavigationRef = useRef(false);
    const hasAutoFocusedRef = useRef(false);
    const isDeletingRef = useRef(false);

    // Auto-save hook for periodic saving while editing
    const autoSave = useAutoSave({
        value: contentValue,
        originalValue: note.content,
        onSave: (value) => {
            if (value.trim()) {
                // Save without hashtag parsing (that happens on final blur)
                onEdit(note.id, value.trim(), note.category, note.description);
            }
        },
        debounceMs: autoSaveInterval * 1000,
        enabled: isEditingContent && autoSaveInterval > 0,
    });

    // Sync local content value when note changes (but not while editing)
    // Store value (storeTitleValue) is already reactive and takes precedence via contentValue
    useEffect(() => {
        if (!isEditingContent && storeTitleValue === undefined) {
            setLocalContentValue(note.content);
        }
    }, [note.content, isEditingContent, storeTitleValue]);

    // Auto-focus empty notes when selected (newly created notes)
    useEffect(() => {
        if (isSelected && note.content === '' && !hasAutoFocusedRef.current) {
            hasAutoFocusedRef.current = true;
            setIsEditingContent(true);
            setTimeout(() => {
                contentInputRef.current?.focus();
            }, 0);
        }
        if (!isSelected) {
            hasAutoFocusedRef.current = false;
        }
    }, [isSelected, note.content]);

    // Scroll into view when selected
    useEffect(() => {
        if (isSelected && rowRef.current) {
            rowRef.current.scrollIntoView({ block: 'nearest', behavior: 'auto' });
        }
    }, [isSelected]);

    // Handle editing state focus
    useEffect(() => {
        if (isEditingContent && contentInputRef.current) {
            if (focusFromNavigationRef.current) {
                focusFromNavigationRef.current = false;
                return;
            }

            const input = contentInputRef.current;
            input.focus();

            // Handle click positioning if we have a calculated position
            if (clickXRef.current !== null) {
                const position = clickXRef.current;
                input.setSelectionRange(position, position);
                // Prevent auto-scroll by resetting scrollLeft
                input.scrollLeft = 0;

                // Backup attempt
                setTimeout(() => {
                    if (contentInputRef.current) {
                        contentInputRef.current.setSelectionRange(position, position);
                        contentInputRef.current.scrollLeft = 0;
                    }
                }, 0);

                clickXRef.current = null; // Reset
            }
        }
    }, [isEditingContent]);

    // Handle External Focus (Navigation)
    useEffect(() => {
        if (shouldFocusTitle && isSelected) {
            focusFromNavigationRef.current = true;
            setIsEditingContent(true);
            setTimeout(() => {
                if (contentInputRef.current) {
                    const input = contentInputRef.current;
                    input.focus();
                    const actualLength = input.value.length;
                    const safePosition = Math.max(0, Math.min(desiredColumn, actualLength));
                    input.setSelectionRange(safePosition, safePosition);
                    // Prevent auto-scroll
                    input.scrollLeft = 0;
                }
            }, 0);
            onTitleFocused();
        }
    }, [shouldFocusTitle, isSelected, desiredColumn, onTitleFocused]);

    // Handle ESC key globally to reset content without losing focus
    useHotkeys('escape', () => {
        if (isEditingContent) {
            setContentValue(note.content);
        }
    }, { enableOnFormTags: ['INPUT'] }, [isEditingContent, note.content]);

    const saveContentWithHashtagParsing = useCallback((forceParseEvenIfUnchanged = false): string | null => {
        const trimmedValue = contentValue.trim();

        // Skip if empty
        if (!trimmedValue) {
            return null;
        }

        // Skip if unchanged AND not forced AND no tags to parse
        if (!forceParseEvenIfUnchanged && contentValue === note.content && !hasUnparsedTags(trimmedValue)) {
            return null;
        }

        const parseResult = parseHashtags(trimmedValue, {
            labels: allLabels,
            contacts: contacts,
        });

        console.log('[useNoteRow] parseHashtags result:', {
            trimmedValue,
            contactsCount: contacts.length,
            parseResult,
            hasOnAddAssignee: !!onAddAssignee,
        });

        if (parseResult.parsedHashtags.length === 0) {
            setLocalContentValue(trimmedValue);
            storeSetTitleValue(note.id, trimmedValue);
            onEdit(note.id, trimmedValue, note.category, note.description);
            return trimmedValue;
        }

        const finalCategory = parseResult.category || note.category;

        // Agregar todos los contactos mencionados como assignees
        for (const parsed of parseResult.parsedHashtags) {
            if (parsed.type === 'contact' && parsed.matchedId) {
                onAddAssignee?.(note.id, parsed.matchedId);
            }
        }

        for (const labelId of parseResult.labelIds) {
            onAddLabel?.(note.id, labelId);
        }

        for (const labelName of parseResult.newLabelNames) {
            onCreateLabelAndAdd?.(note.id, labelName);
        }

        // Update both local state and Zustand store directly to avoid stale closure issues
        setLocalContentValue(parseResult.cleanedContent);
        storeSetTitleValue(note.id, parseResult.cleanedContent);
        onEdit(note.id, parseResult.cleanedContent, finalCategory, note.description);

        const details: string[] = [];
        for (const parsed of parseResult.parsedHashtags) {
            switch (parsed.type) {
                case 'category':
                    details.push(t('toast.hashtagCategory', { name: parsed.tag }));
                    break;
                case 'contact': {
                    const contact = contacts.find(c => c.id === parsed.matchedId);
                    const contactName = contact ? `${contact.name} ${contact.lastname}`.trim() : parsed.tag;
                    details.push(t('toast.hashtagContact', { name: contactName }));
                    break;
                }
                case 'label': {
                    const label = allLabels.find(l => l.id === parsed.matchedId);
                    details.push(t('toast.hashtagLabel', { name: label?.name || parsed.tag }));
                    break;
                }
                case 'new_label':
                    details.push(t('toast.hashtagNewLabel', { name: parsed.tag }));
                    break;
            }
        }

        if (details.length > 0) {
            toast.success(t('toast.hashtagsParsed', { details: details.join(', ') }));
        }

        return parseResult.cleanedContent;
    }, [contentValue, note.content, note.category, note.description, note.id, allLabels, contacts, onEdit, onAddAssignee, onAddLabel, onCreateLabelAndAdd, storeSetTitleValue, t]);

    const handleContentBlur = useCallback(() => {
        if (isDeletingRef.current) return;
        if (isCommandPaletteOpen) return;

        if (showLabelDropdown || showCategoryDropdown || showAssigneeDropdown || showDeleteDialog) return;

        // Flush any pending auto-save
        autoSave.handleBlur();

        const trimmed = contentValue.trim();
        const hasTags = hasUnparsedTags(trimmed);
        const contentChanged = contentValue !== note.content;

        console.log('[useNoteRow] handleContentBlur:', {
            contentValue,
            noteContent: note.content,
            contentChanged,
            hasTags,
            willParse: !!(trimmed && (contentChanged || hasTags)),
            contactsLength: contacts.length,
        });

        if (trimmed && (contentChanged || hasTags)) {
            // Force parse if content has tags, even if autoSave already saved raw content
            saveContentWithHashtagParsing(hasTags);
        } else if (!trimmed) {
            setContentValue(note.content);
        }
        setIsEditingContent(false);
    }, [contentValue, note.content, isCommandPaletteOpen, saveContentWithHashtagParsing, showLabelDropdown, showCategoryDropdown, showAssigneeDropdown, showDeleteDialog, autoSave, contacts]);

    const handleCheckedChange = useCallback(() => {
        // If completing a task (not already completed), animate first
        if (!note.completed) {
            setIsCompleting(true);
            // Wait for animation to finish (400ms strikethrough + 200ms fade)
            setTimeout(() => {
                onToggleCompleted(note.id, true);
                // Don't reset isCompleting - the note will be removed from the list anyway
            }, 600);
        } else {
            // If uncompleting, just toggle immediately
            onToggleCompleted(note.id, false);
        }
    }, [note.id, note.completed, onToggleCompleted]);

    const handleContentKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'd' && e.ctrlKey && note.category !== 'notes' && note.category !== 'meeting') {
            e.preventDefault();
            e.stopPropagation();
            const trimmed = contentValue.trim();
            if (trimmed && (contentValue !== note.content || hasUnparsedTags(trimmed))) {
                saveContentWithHashtagParsing(hasUnparsedTags(trimmed));
            }
            // Use animated completion via handleCheckedChange
            handleCheckedChange();
            return;
        }
        if (e.key === 'Backspace' && e.ctrlKey) {
            e.preventDefault();
            e.stopPropagation();
            setShowDeleteDialog(true);
            return;
        }
        if (e.key === 'Enter' && !e.shiftKey && !e.repeat) {
            e.preventDefault();
            if (!note.completed && contentValue.trim()) {
                // Save content to store immediately before creating the new note.
                // This prevents a flash of "Nueva tarea..." placeholder when the
                // old note switches from input→span, because note.content would
                // otherwise still be stale (empty) due to the debounced loadNotes.
                const trimmed = contentValue.trim();
                if (trimmed !== note.content || hasUnparsedTags(trimmed)) {
                    saveContentWithHashtagParsing(hasUnparsedTags(trimmed));
                }
                // Hide the caret instantly so it doesn't visibly jump
                // during the transition to the new row.
                if (contentInputRef.current) {
                    contentInputRef.current.style.caretColor = 'transparent';
                }
                onCreateNoteAfter?.(note.id);
            } else {
                const trimmed = contentValue.trim();
                if (trimmed && (contentValue !== note.content || hasUnparsedTags(trimmed))) {
                    saveContentWithHashtagParsing(hasUnparsedTags(trimmed));
                }
                setIsEditingContent(false);
            }
        } else if (e.key === 'Backspace' && contentValue === '') {
            e.preventDefault();
            // Mark as deleting so the blur handler doesn't switch to
            // the span (which would flash the placeholder text).
            isDeletingRef.current = true;
            // Blur the input so focus doesn't get lost to <body> when
            // the row unmounts. handleDeleteWithToast handles navigation.
            contentInputRef.current?.blur();
            onDeleteWithToast(note, 'empty');
        } else if (e.key === 'ArrowDown') {
            const column = contentInputRef.current?.selectionStart ?? 0;
            const didNavigate = onNavigateDown(note.id, column);
            if (didNavigate) {
                e.preventDefault();
                handleContentBlur();
            }
        } else if (e.key === 'ArrowUp') {
            const column = contentInputRef.current?.selectionStart ?? 0;
            const didNavigate = onNavigateUp(note.id, column);
            if (didNavigate) {
                e.preventDefault();
                handleContentBlur();
            }
        }
    }, [contentValue, note, saveContentWithHashtagParsing, handleCheckedChange, onCreateNoteAfter, handleContentBlur, onNavigateToDescription, onNavigateDown, onNavigateUp]);

    const handleContentClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        onSelect(note.id);

        const target = e.target as HTMLElement;
        // Relaxed check: Just ensure we clicked the text span (or an element inside it that might bubble up)
        if (target.tagName === 'SPAN') {
            const rect = target.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const style = window.getComputedStyle(target);
            const fontString = getFontString(style);

            // Calculate position immediately using the span's style
            const position = getCursorPosition(target.textContent || '', fontString, clickX);
            clickXRef.current = position;
        } else {
            clickXRef.current = null;
        }
        setIsEditingContent(true);
    }, [note.id, onSelect]);

    const handleConfirmDelete = useCallback((reason: string) => {
        onDeleteWithToast(note, reason);
        setShowDeleteDialog(false);
    }, [onDeleteWithToast, note]);

    // Handlers for dropdowns
    const handleLabelDropdownOpenChange = (open: boolean) => {
        setShowLabelDropdown(open);
        if (!open) contentInputRef.current?.focus();
    };

    const handleCategoryDropdownOpenChange = (open: boolean) => {
        setShowCategoryDropdown(open);
        if (!open) contentInputRef.current?.focus();
    };

    const handleAssigneeDropdownOpenChange = (open: boolean) => {
        setShowAssigneeDropdown(open);
        if (!open) contentInputRef.current?.focus();
    };

    return {
        // State
        contentValue,
        setContentValue,
        isEditingContent,
        setIsEditingContent,
        showLabelDropdown,
        showCategoryDropdown,
        showAssigneeDropdown,
        showDeleteDialog,
        setShowDeleteDialog,
        isCompleting,

        // Refs
        rowRef,
        contentInputRef,
        clickXRef,

        // Handlers
        handleContentKeyDown,
        handleContentBlur,
        handleContentClick,
        handleCheckedChange,
        handleConfirmDelete,
        saveContentWithHashtagParsing,

        // Dropdown Handlers
        handleLabelDropdownOpenChange,
        handleCategoryDropdownOpenChange,
        handleAssigneeDropdownOpenChange,
    };
}
