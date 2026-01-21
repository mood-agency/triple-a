import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pickaxe, Forward, StickyNote, Check, X } from 'lucide-react';
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

interface CommandPaletteProps {
  labels: Label[];
  selectedLabels: string[];
  onSelectLabel: (labelId: string) => void;
  onClearLabels: () => void;
  categoryFilter: NoteCategory | 'all';
  onSelectCategory: (category: NoteCategory | 'all') => void;
}

export function CommandPalette({
  labels,
  selectedLabels,
  onSelectLabel,
  onClearLabels,
  categoryFilter,
  onSelectCategory,
}: CommandPaletteProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setOpen((prev) => !prev);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleSelectLabel = (labelId: string) => {
    onSelectLabel(labelId);
  };

  const handleSelectCategory = (category: NoteCategory | 'all') => {
    onSelectCategory(category);
    setOpen(false);
  };

  const handleClearFilters = () => {
    onClearLabels();
    onSelectCategory('all');
    setOpen(false);
  };

  const hasActiveFilters = selectedLabels.length > 0 || categoryFilter !== 'all';

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
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
