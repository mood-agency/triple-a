import { useTranslation } from 'react-i18next';
import { Check, Pickaxe, Forward, StickyNote, Users, Plus, Pencil } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from '@/components/ui/command';
import { type DraggableSyntheticListeners } from '@dnd-kit/core';
import type { Note, Label } from '@/types/note';
import type { Contact } from '@/types/contact';
import { useDebugNavigation } from '@/hooks/useDebugNavigation';

interface NoteRowContentProps {
    note: Note;
    contentValue: string;
    setContentValue: (value: string) => void;
    isEditingContent: boolean;
    contentInputRef: React.RefObject<HTMLInputElement | null>;
    isDragging: boolean;
    isSelected: boolean;
    isDescriptionFocused: boolean;
    compactView: boolean;
    listeners?: DraggableSyntheticListeners;
    attributes?: any;
    onContentClick: (e: React.MouseEvent<HTMLDivElement>) => void;
    onContentChange?: (content: string) => void;
    onContentBlur: () => void;
    onContentKeyDown: (e: React.KeyboardEvent) => void;
    // Dropdown props
    showLabelDropdown: boolean;
    onLabelDropdownOpenChange: (open: boolean) => void;
    showCategoryDropdown: boolean;
    onCategoryDropdownOpenChange: (open: boolean) => void;
    showAssigneeDropdown: boolean;
    onAssigneeDropdownOpenChange: (open: boolean) => void;
    // Data props
    allLabels: Label[];
    labels: Label[];
    contacts: Contact[];
    // Handlers
    onAddLabel?: (noteId: string, labelId: string) => void;
    onRemoveLabel?: (noteId: string, labelId: string) => void;
    onEditLabel?: (label: Label) => void;
    onCreateLabel?: () => void;
    onEdit: (id: string, content: string, category?: any, description?: string | null) => void;
    onUpdateAssignee?: (noteId: string, assigneeId: string | null) => void;
}

export function NoteRowContent({
    note,
    contentValue,
    setContentValue,
    isEditingContent,
    contentInputRef,
    isDragging,
    isSelected,
    isDescriptionFocused,
    compactView,
    listeners,
    attributes,
    onContentClick,
    onContentChange,
    onContentBlur,
    onContentKeyDown,
    showLabelDropdown,
    onLabelDropdownOpenChange,
    showCategoryDropdown,
    onCategoryDropdownOpenChange,
    showAssigneeDropdown,
    onAssigneeDropdownOpenChange,
    allLabels,
    labels,
    contacts,
    onAddLabel,
    onRemoveLabel,
    onEditLabel,
    onCreateLabel,
    onEdit,
    onUpdateAssignee,
}: NoteRowContentProps) {
    const { t } = useTranslation();
    const { debugMode, debugTitleFocusClass } = useDebugNavigation();

    return (
        <div className={`group/title relative select-none flex items-center gap-1.5 flex-1 min-w-0 ${!compactView ? 'pl-1.5' : ''} overflow-hidden`} onClick={onContentClick}>
            {isEditingContent ? (
                <>
                    <input
                        ref={contentInputRef}
                        type="text"
                        value={contentValue}
                        tabIndex={-1}
                        onChange={(e) => {
                            setContentValue(e.target.value);
                            onContentChange?.(e.target.value);
                        }}
                        onBlur={onContentBlur}
                        onKeyDown={onContentKeyDown}
                        onFocus={(e) => {
                            // Prevent the input from auto-scrolling when focused
                            e.target.scrollLeft = 0;
                        }}
                        placeholder={t('newTaskPlaceholder')}
                        className={`flex-1 min-w-0 text-sm leading-4 bg-transparent border-none outline-none p-0 m-0 text-foreground caret-foreground placeholder:text-muted-foreground/50 cursor-text ${debugMode ? debugTitleFocusClass : ''}`}
                    />

                    {/* Label Dropdown */}
                    <Popover open={showLabelDropdown} onOpenChange={onLabelDropdownOpenChange}>
                        <PopoverTrigger asChild>
                            <span className="sr-only">Labels</span>
                        </PopoverTrigger>
                        <PopoverContent className="w-52 p-0" align="start">
                            <Command>
                                <CommandInput placeholder={t('searchLabels')} className="h-9" />
                                <CommandList>
                                    <CommandEmpty>{t('noLabelsFound')}</CommandEmpty>
                                    <CommandGroup>
                                        {allLabels.map((label) => {
                                            const isAssigned = labels.some(l => l.id === label.id);
                                            return (
                                                <CommandItem
                                                    key={label.id}
                                                    value={label.name}
                                                    onSelect={() => {
                                                        if (isAssigned) {
                                                            onRemoveLabel?.(note.id, label.id);
                                                        } else {
                                                            onAddLabel?.(note.id, label.id);
                                                        }
                                                        onLabelDropdownOpenChange(false);
                                                    }}
                                                    className="group flex items-center justify-between"
                                                >
                                                    <div className="flex items-center">
                                                        <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: label.color }} />
                                                        {label.name}
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        {isAssigned && <Check className="h-4 w-4" />}
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onEditLabel?.(label);
                                                                onLabelDropdownOpenChange(false);
                                                            }}
                                                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded transition-opacity"
                                                        >
                                                            <Pencil className="h-3 w-3 text-muted-foreground" />
                                                        </button>
                                                    </div>
                                                </CommandItem>
                                            );
                                        })}
                                    </CommandGroup>
                                    <CommandSeparator />
                                    <CommandGroup>
                                        <CommandItem
                                            onSelect={() => {
                                                onCreateLabel?.();
                                                onLabelDropdownOpenChange(false);
                                            }}
                                        >
                                            <Plus className="h-3 w-3 mr-2" />
                                            {t('createLabel')}
                                        </CommandItem>
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>

                    {/* Category Dropdown */}
                    <Popover open={showCategoryDropdown} onOpenChange={onCategoryDropdownOpenChange}>
                        <PopoverTrigger asChild>
                            <span className="sr-only">{t('category')}</span>
                        </PopoverTrigger>
                        <PopoverContent className="w-44 p-0" align="start">
                            <Command>
                                <CommandInput placeholder={t('searchCategory')} className="h-9" />
                                <CommandList>
                                    <CommandEmpty>{t('noCategoriesFound')}</CommandEmpty>
                                    <CommandGroup>
                                        <CommandItem value="todo" onSelect={() => { onEdit(note.id, note.content, 'todo', note.description); onCategoryDropdownOpenChange(false); }} className="flex items-center justify-between">
                                            <div className="flex items-center"><Pickaxe className="h-4 w-4 mr-2" />{t('categoryTodo')}</div>
                                            {note.category === 'todo' && <Check className="h-4 w-4" />}
                                        </CommandItem>
                                        <CommandItem value="followup" onSelect={() => { onEdit(note.id, note.content, 'followup', note.description); onCategoryDropdownOpenChange(false); }} className="flex items-center justify-between">
                                            <div className="flex items-center"><Forward className="h-4 w-4 mr-2" />{t('categoryFollowUp')}</div>
                                            {note.category === 'followup' && <Check className="h-4 w-4" />}
                                        </CommandItem>
                                        <CommandItem value="notes" onSelect={() => { onEdit(note.id, note.content, 'notes', note.description); onCategoryDropdownOpenChange(false); }} className="flex items-center justify-between">
                                            <div className="flex items-center"><StickyNote className="h-4 w-4 mr-2" />{t('categoryNotes')}</div>
                                            {note.category === 'notes' && <Check className="h-4 w-4" />}
                                        </CommandItem>
                                        <CommandItem value="meeting" onSelect={() => { onEdit(note.id, note.content, 'meeting', note.description); onCategoryDropdownOpenChange(false); }} className="flex items-center justify-between">
                                            <div className="flex items-center"><Users className="h-4 w-4 mr-2" />{t('categoryMeeting')}</div>
                                            {note.category === 'meeting' && <Check className="h-4 w-4" />}
                                        </CommandItem>
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>

                    {/* Assignee Dropdown */}
                    <Popover open={showAssigneeDropdown} onOpenChange={onAssigneeDropdownOpenChange}>
                        <PopoverTrigger asChild>
                            <span className="sr-only">{t('assignee.setAssignee')}</span>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-0" align="start">
                            <Command>
                                <CommandInput placeholder={t('assignee.search')} className="h-9" />
                                <CommandList>
                                    <CommandEmpty>{t('assignee.noResults')}</CommandEmpty>
                                    <CommandGroup>
                                        {contacts.map((contact) => {
                                            const fullName = `${contact.name} ${contact.lastname}`.trim();
                                            return (
                                                <CommandItem
                                                    key={contact.id}
                                                    value={fullName}
                                                    onSelect={() => {
                                                        onUpdateAssignee?.(note.id, contact.id === note.assignee_id ? null : contact.id);
                                                        onAssigneeDropdownOpenChange(false);
                                                    }}
                                                    className="flex items-center justify-between"
                                                >
                                                    <span className="truncate">{fullName}</span>
                                                    {note.assignee_id === contact.id && <Check className="h-4 w-4" />}
                                                </CommandItem>
                                            );
                                        })}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </>
            ) : (
                <span
                    className={`flex-1 min-w-0 text-sm leading-4 truncate ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} hover:cursor-text ${note.completed ? 'line-through text-muted-foreground' : ''} ${isSelected && isDescriptionFocused ? 'cursor-text underline decoration-primary decoration-2 underline-offset-2' : ''} ${!contentValue ? 'text-muted-foreground/50 italic' : ''}`}
                    {...attributes}
                    {...listeners}
                >
                    {contentValue || t('newTaskPlaceholder')}
                </span>
            )}
        </div>
    );
}
