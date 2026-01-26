import { useEffect, useState, useCallback, useRef } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useTranslation } from 'react-i18next';
import { Pickaxe, Forward, StickyNote, Check, X, Users, Calendar, List, FolderKanban } from 'lucide-react';
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
import type { Project } from '@/types/project';

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
  // Project switching
  projects?: Project[];
  activeProjectId?: string | null;
  onSelectProject?: (projectId: string) => void;
}

type PaletteMode = 'commands' | 'projects';

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
  projects = [],
  activeProjectId,
  onSelectProject,
}: CommandPaletteProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PaletteMode>('commands');
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
      // Reset mode to commands when closing, but with a slight delay to avoid UI flicker
      setTimeout(() => setMode('commands'), 300);
    }
    setOpen(newOpen);
  }, [saveFocusState, restoreFocusState]);

  // Ctrl+K to toggle command palette (commands mode)
  useHotkeys('ctrl+k, meta+k', () => {
    if (open && mode === 'commands') {
      handleOpenChange(false);
    } else {
      setMode('commands');
      if (!open) {
        saveFocusState();
        setOpen(true);
      }
    }
  }, { preventDefault: true, enableOnFormTags: true }, [open, mode, saveFocusState, handleOpenChange]);

  // Ctrl+P to toggle command palette (projects mode)
  useHotkeys('ctrl+p, meta+p', () => {
    if (open && mode === 'projects') {
      handleOpenChange(false);
    } else {
      setMode('projects');
      if (!open) {
        saveFocusState();
        setOpen(true);
      }
    }
  }, { preventDefault: true, enableOnFormTags: true }, [open, mode, saveFocusState, handleOpenChange]);

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

  const handleSelectProject = (projectId: string) => {
    onSelectProject?.(projectId);
    handleOpenChange(false);
  };

  const hasActiveFilters = selectedLabels.length > 0 || categoryFilter !== 'all';

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <CommandInput
        placeholder={mode === 'projects' ? t('projects.searchProjects', 'Search projects...') : t('commandPalettePlaceholder')}
      />
      <CommandList>
        <CommandEmpty>{t('noResults')}</CommandEmpty>

        {mode === 'projects' ? (
          <CommandGroup heading={t('projects.allProjects', 'Projects')}>
            {projects.map(project => (
              <CommandItem
                key={project.id}
                value={project.name}
                onSelect={() => handleSelectProject(project.id)}
              >
                {project.icon ? (
                  <span className="flex items-center justify-center w-4 h-4 mr-2 shrink-0 text-base leading-none">
                    {project.icon}
                  </span>
                ) : (
                  <FolderKanban className="mr-2 h-4 w-4" style={{ color: project.color }} />
                )}
                <span className="flex-1">{project.name}</span>
                {project.id === activeProjectId && <Check className="h-4 w-4 text-primary" />}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : (
          <>
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
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
