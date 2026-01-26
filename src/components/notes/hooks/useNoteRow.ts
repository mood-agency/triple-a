import { useState, useRef, useEffect, useCallback } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { parseHashtags } from '@/utils/hashtagParser';
import type { Note, NoteCategory, Label } from '@/types/note';
import type { Contact } from '@/types/contact';
import { getCursorPosition, getFontString } from '@/utils/cursorUtils';

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
    onAddLabel?: (noteId: string, labelId: string) => void;
    onCreateLabelAndAdd?: (noteId: string, labelName: string) => void;
    isCommandPaletteOpen?: boolean;
    onContentChange?: (content: string) => void;
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
    onUpdateAssignee,
    onAddLabel,
    onCreateLabelAndAdd,
    isCommandPaletteOpen,
}: UseNoteRowProps) {
    const { t } = useTranslation();
    const [isEditingContent, setIsEditingContent] = useState(false);
    const [contentValue, setContentValue] = useState(note.content);

    // Dropdown states
    const [showLabelDropdown, setShowLabelDropdown] = useState(false);
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
    const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    // Refs
    const rowRef = useRef<HTMLDivElement>(null);
    const contentInputRef = useRef<HTMLInputElement>(null);
    const clickXRef = useRef<number | null>(null);
    const focusFromNavigationRef = useRef(false);
    const hasAutoFocusedRef = useRef(false);

    // Sync content value when note changes
    useEffect(() => {
        setContentValue(note.content);
    }, [note.content]);

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

    const saveContentWithHashtagParsing = useCallback((): string | null => {
        if (!contentValue.trim() || contentValue === note.content) {
            return null;
        }

        const trimmedValue = contentValue.trim();

        const parseResult = parseHashtags(trimmedValue, {
            labels: allLabels,
            contacts: contacts,
        });

        if (parseResult.parsedHashtags.length === 0) {
            setContentValue(trimmedValue);
            onEdit(note.id, trimmedValue, note.category, note.description);
            return trimmedValue;
        }

        const finalCategory = parseResult.category || note.category;

        if (parseResult.assigneeId && parseResult.assigneeId !== note.assignee_id) {
            onUpdateAssignee?.(note.id, parseResult.assigneeId);
        }

        for (const labelId of parseResult.labelIds) {
            onAddLabel?.(note.id, labelId);
        }

        for (const labelName of parseResult.newLabelNames) {
            onCreateLabelAndAdd?.(note.id, labelName);
        }

        setContentValue(parseResult.cleanedContent);
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
    }, [contentValue, note.content, note.category, note.description, note.id, note.assignee_id, allLabels, contacts, onEdit, onUpdateAssignee, onAddLabel, onCreateLabelAndAdd, t]);

    const handleContentBlur = useCallback(() => {
        if (isCommandPaletteOpen) return;

        if (showLabelDropdown || showCategoryDropdown || showAssigneeDropdown) return;

        if (contentValue.trim() && contentValue !== note.content) {
            saveContentWithHashtagParsing();
        } else if (!contentValue.trim()) {
            setContentValue(note.content);
        }
        setIsEditingContent(false);
    }, [contentValue, note.content, isCommandPaletteOpen, saveContentWithHashtagParsing, showLabelDropdown, showCategoryDropdown, showAssigneeDropdown]);


    const handleContentKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'd' && e.ctrlKey && note.category !== 'notes' && note.category !== 'meeting') {
            e.preventDefault();
            e.stopPropagation();
            if (contentValue.trim() && contentValue !== note.content) {
                saveContentWithHashtagParsing();
            }
            onToggleCompleted(note.id, !note.completed);
            return;
        }
        if (e.key === 'Backspace' && e.ctrlKey) {
            e.preventDefault();
            e.stopPropagation();
            setIsEditingContent(false);
            setShowDeleteDialog(true);
            return;
        }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (contentValue.trim() && contentValue !== note.content) {
                saveContentWithHashtagParsing();
            }
            setIsEditingContent(false);
            if (!note.completed) {
                onCreateNoteAfter?.(note.id);
            }
        } else if (e.key === 'Backspace' && contentValue === '') {
            e.preventDefault();
            setIsEditingContent(false);
            setShowDeleteDialog(true);
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
    }, [contentValue, note, saveContentWithHashtagParsing, onToggleCompleted, onCreateNoteAfter, handleContentBlur, onNavigateToDescription, onNavigateDown, onNavigateUp]);

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

    const handleCheckedChange = useCallback(() => {
        onToggleCompleted(note.id, !note.completed);
    }, [note.id, note.completed, onToggleCompleted]);

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
