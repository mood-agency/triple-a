import { useEffect, useState, useCallback, useRef } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useTranslation } from 'react-i18next';
import { Pickaxe, Forward, StickyNote, Check, X, Users } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
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
}

export function CommandPalette({
  labels,
  selectedLabels,
  onSelectLabel,
  onClearLabels,
  categoryFilter,
  onSelectCategory,
  onOpenStateChange,
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
                <X className="mr-2 h-4 w-4" />
                {t('clearAllFilters')}
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading={t('filterByCategory')}>
          <CommandItem onSelect={() => handleSelectCategory('all')}>
            <Check className={`mr-2 h-4 w-4 ${categoryFilter === 'all' ? 'opacity-100' : 'opacity-0'}`} />
            {t('allCategories')}
          </CommandItem>
          <CommandItem onSelect={() => handleSelectCategory('todo')}>
            <Pickaxe className="mr-2 h-4 w-4" />
            <Check className={`mr-2 h-4 w-4 ${categoryFilter === 'todo' ? 'opacity-100' : 'opacity-0'}`} />
            {t('categoryTodo')}
          </CommandItem>
          <CommandItem onSelect={() => handleSelectCategory('followup')}>
            <Forward className="mr-2 h-4 w-4" />
            <Check className={`mr-2 h-4 w-4 ${categoryFilter === 'followup' ? 'opacity-100' : 'opacity-0'}`} />
            {t('categoryFollowUp')}
          </CommandItem>
          <CommandItem onSelect={() => handleSelectCategory('notes')}>
            <StickyNote className="mr-2 h-4 w-4" />
            <Check className={`mr-2 h-4 w-4 ${categoryFilter === 'notes' ? 'opacity-100' : 'opacity-0'}`} />
            {t('categoryNotes')}
          </CommandItem>
          <CommandItem onSelect={() => handleSelectCategory('meeting')}>
            <Users className="mr-2 h-4 w-4" />
            <Check className={`mr-2 h-4 w-4 ${categoryFilter === 'meeting' ? 'opacity-100' : 'opacity-0'}`} />
            {t('categoryMeeting')}
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
                      className="mr-2 h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: label.color }}
                    />
                    <span className="flex-1">{label.name}</span>
                    {isSelected && <Check className="h-4 w-4 text-primary" />}
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
