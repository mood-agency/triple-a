import { useEffect, useState, useCallback, useRef } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useTranslation } from 'react-i18next';
import { Pickaxe, Forward, StickyNote, Check, X, Users, Calendar, List } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import type { Label, NoteCategory } from '@/types/note';

interface FocusState {
  element: HTMLElement;
  selectionStart: number | null;
  selectionEnd: number | null;
}

interface CommandPaletteProps {
  labels: Label[];
  selectedLabels: string[];
  onSelectLabel: (labelId: string) => void;
  onClearLabels: () => void;
  categoryFilter: NoteCategory | 'all';
  onSelectCategory: (category: NoteCategory | 'all') => void;
  onOpenStateChange?: (isOpen: boolean) => void;
  viewMode: 'list' | 'calendar';
  onToggleViewMode: () => void;
}

export function CommandPalette({
  labels,
  selectedLabels,
  onSelectLabel,
  onClearLabels,
  categoryFilter,
  onSelectCategory,
  onOpenStateChange,
  viewMode,
  onToggleViewMode,
}: CommandPaletteProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const savedFocusRef = useRef<FocusState | null>(null);

  // Notify parent of open state changes
  useEffect(() => {
    onOpenStateChange?.(open);
  }, [open, onOpenStateChange]);

  const saveFocusState = useCallback(() => {
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement && activeElement !== document.body) {
      const focusState: FocusState = {
        element: activeElement,
        selectionStart: null,
        selectionEnd: null,
      };

      // Save cursor position for input elements
      if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
        focusState.selectionStart = activeElement.selectionStart;
        focusState.selectionEnd = activeElement.selectionEnd;
      }

      savedFocusRef.current = focusState;
    }
  }, []);

  const restoreFocusState = useCallback(() => {
    const savedFocus = savedFocusRef.current;
    if (savedFocus && savedFocus.element) {
      // Use setTimeout to ensure the dialog has fully closed
      setTimeout(() => {
        savedFocus.element.focus();

        // Restore cursor position for input elements
        if (
          (savedFocus.element instanceof HTMLInputElement || savedFocus.element instanceof HTMLTextAreaElement) &&
          savedFocus.selectionStart !== null &&
          savedFocus.selectionEnd !== null
        ) {
          savedFocus.element.setSelectionRange(savedFocus.selectionStart, savedFocus.selectionEnd);
        }

        savedFocusRef.current = null;
      }, 0);
    }
  }, []);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (newOpen) {
      saveFocusState();
    } else {
      restoreFocusState();
    }
    setOpen(newOpen);
  }, [saveFocusState, restoreFocusState]);

  // Ctrl+K to toggle command palette
  useHotkeys('ctrl+k, meta+k', () => {
    if (open) {
      handleOpenChange(false);
    } else {
      saveFocusState();
      setOpen(true);
    }
  }, { preventDefault: true, enableOnFormTags: true }, [open, saveFocusState, handleOpenChange]);

  const handleSelectLabel = (labelId: string) => {
    onSelectLabel(labelId);
  };

  const handleSelectCategory = (category: NoteCategory | 'all') => {
    onSelectCategory(category);
    handleOpenChange(false);
  };

  const handleClearFilters = () => {
    onClearLabels();
    onSelectCategory('all');
    handleOpenChange(false);
  };

  const handleToggleViewMode = () => {
    onToggleViewMode();
    handleOpenChange(false);
  };

  const hasActiveFilters = selectedLabels.length > 0 || categoryFilter !== 'all';

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <CommandInput placeholder={t('commandPalettePlaceholder')} />
      <CommandList>
        <CommandEmpty>{t('noResults')}</CommandEmpty>

        {hasActiveFilters && (
          <>
            <CommandGroup heading={t('activeFilters')}>
              <CommandItem onSelect={handleClearFilters}>
                <X />
                {t('clearAllFilters')}
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading={t('commandPalette.view')}>
          <CommandItem onSelect={handleToggleViewMode}>
            {viewMode === 'list' ? <Calendar /> : <List />}
            {viewMode === 'list' ? t('calendar.switchToCalendarView') : t('calendar.switchToListView')}
            <CommandShortcut>Ctrl Shift C</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading={t('filterByCategory')}>
          <CommandItem onSelect={() => handleSelectCategory('all')}>
            {categoryFilter === 'all' ? (
              <Check className="text-primary" />
            ) : (
              <span className="w-4" />
            )}
            {t('allCategories')}
            <CommandShortcut>Alt C</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelectCategory('todo')}>
            <Pickaxe />
            {t('categoryTodo')}
            {categoryFilter === 'todo' && <Check className="text-primary" />}
            <CommandShortcut>Alt Q</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelectCategory('followup')}>
            <Forward />
            {t('categoryFollowUp')}
            {categoryFilter === 'followup' && <Check className="text-primary" />}
            <CommandShortcut>Alt W</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelectCategory('notes')}>
            <StickyNote />
            {t('categoryNotes')}
            {categoryFilter === 'notes' && <Check className="text-primary" />}
            <CommandShortcut>Alt E</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelectCategory('meeting')}>
            <Users />
            {t('categoryMeeting')}
            {categoryFilter === 'meeting' && <Check className="text-primary" />}
            <CommandShortcut>Alt R</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        {labels.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t('filterByLabel')}>
              {labels.map((label) => {
                const isSelected = selectedLabels.includes(label.id);
                return (
                  <CommandItem
                    key={label.id}
                    value={label.name}
                    onSelect={() => handleSelectLabel(label.id)}
                  >
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: label.color }}
                    />
                    {label.name}
                    {isSelected && <Check className="text-primary" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
