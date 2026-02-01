import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pickaxe, Forward, StickyNote, Check, X, Users, Calendar, List, FolderKanban, User, ArrowUp, ArrowDown, Calendar as CalendarIcon, Layers, CircleDot, CheckCircle2, Trash2, AlertTriangle, Plus } from 'lucide-react';
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
import { useCommandPalette } from '@/contexts/CommandPaletteContext';
import type { Label, NoteCategory } from '@/types/note';
import type { Project } from '@/types/project';
import type { Contact } from '@/types/contact';

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
  onRequestCreateProject?: () => void;
  // Assignee filtering
  contacts?: Contact[];
  selectedAssignees?: string[];
  onSelectAssignee?: (assigneeId: string) => void;
  onClearAssignees?: () => void;
  // Sort configuration
  sortConfig?: { deadline: 'asc' | 'desc' | null; assignee: 'asc' | 'desc' | null; category: 'asc' | 'desc' | null };
  onSortChange?: (config: { deadline: 'asc' | 'desc' | null; assignee: 'asc' | 'desc' | null; category: 'asc' | 'desc' | null }) => void;
  // Task status filter
  taskStatusFilter?: 'active' | 'completed' | 'deleted';
  onTaskStatusFilterChange?: (status: 'active' | 'completed' | 'deleted') => void;
  showOverdueOnly?: boolean;
  onShowOverdueOnlyChange?: (show: boolean) => void;
  hasCompletedTasks?: boolean;
  hasDeletedTasks?: boolean;
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
  projects = [],
  activeProjectId,
  onSelectProject,
  onRequestCreateProject,
  contacts = [],
  selectedAssignees = [],
  onSelectAssignee,
  onClearAssignees,
  sortConfig = { deadline: null, assignee: null, category: null },
  onSortChange,
  taskStatusFilter = 'active',
  onTaskStatusFilterChange,
  showOverdueOnly = false,
  onShowOverdueOnlyChange,
  hasCompletedTasks = false,
  hasDeletedTasks = false,
}: CommandPaletteProps) {
  const { t } = useTranslation();
  const { isOpen, mode, handleOpenChange, close, closeWithoutFocusRestore } = useCommandPalette();

  // Notify parent of open state changes
  useEffect(() => {
    onOpenStateChange?.(isOpen);
  }, [isOpen, onOpenStateChange]);

  const handleSelectLabel = (labelId: string) => {
    onSelectLabel(labelId);
  };

  const handleSelectCategory = (category: NoteCategory | 'all') => {
    onSelectCategory(category);
    closeWithoutFocusRestore();
  };

  const handleClearFilters = () => {
    onClearLabels();
    onClearAssignees?.();
    onSelectCategory('all');
    onSortChange?.({ deadline: null, assignee: null, category: null });
    onTaskStatusFilterChange?.('active');
    onShowOverdueOnlyChange?.(false);
    closeWithoutFocusRestore();
  };

  const handleToggleViewMode = () => {
    onToggleViewMode();
    closeWithoutFocusRestore();
  };

  const handleSelectProject = (projectId: string) => {
    onSelectProject?.(projectId);
    closeWithoutFocusRestore();
  };

  const hasActiveSort = sortConfig.deadline !== null || sortConfig.assignee !== null || sortConfig.category !== null;
  const hasActiveFilters = selectedLabels.length > 0 || categoryFilter !== 'all' || selectedAssignees.length > 0 || hasActiveSort || taskStatusFilter !== 'active' || showOverdueOnly;

  const handleSelectAssignee = (assigneeId: string) => {
    onSelectAssignee?.(assigneeId);
  };

  const handleClearAssignees = () => {
    onClearAssignees?.();
  };

  const handleSetSort = (field: 'deadline' | 'assignee' | 'category', direction: 'asc' | 'desc' | null) => {
    // Only one sort can be active at a time - clear others when setting a new one
    onSortChange?.({ deadline: null, assignee: null, category: null, [field]: direction });
    closeWithoutFocusRestore();
  };

  const handleClearSort = () => {
    onSortChange?.({ deadline: null, assignee: null, category: null });
    closeWithoutFocusRestore();
  };

  return (
    <CommandDialog open={isOpen} onOpenChange={handleOpenChange}>
      <CommandInput
        placeholder={
          mode === 'projects' ? t('projects.searchProjects', 'Search projects...') :
          mode === 'labels' ? t('commandPalette.searchLabels', 'Search labels...') :
          mode === 'assignees' ? t('commandPalette.searchAssignees', 'Search assignees...') :
          t('commandPalettePlaceholder')
        }
      />
      <CommandList>
        <CommandEmpty>{t('noResults')}</CommandEmpty>

        {mode === 'projects' && (
          <CommandGroup heading={t('projects.allProjects', 'Projects')}>
            <CommandItem
              key="create-project"
              value="add project create new agregar crear nuevo"
              onSelect={() => {
                onRequestCreateProject?.();
                close();
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('projects.addProject')}
            </CommandItem>
            <CommandSeparator className="my-1" />
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
        )}

        {mode === 'labels' && (
          <CommandGroup heading={t('filterByLabel')}>
            {selectedLabels.length > 0 && (
              <CommandItem onSelect={onClearLabels}>
                <X />
                {t('clearLabelFilter', 'Clear label filter')}
              </CommandItem>
            )}
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
        )}

        {mode === 'assignees' && (
          <CommandGroup heading={t('filterByAssignee')}>
            {selectedAssignees.length > 0 && (
              <CommandItem onSelect={handleClearAssignees}>
                <X />
                {t('clearAssigneeFilter')}
              </CommandItem>
            )}
            {contacts.map((contact) => {
              const isSelected = selectedAssignees.includes(contact.id);
              const fullName = `${contact.name} ${contact.lastname}`.trim();
              return (
                <CommandItem
                  key={contact.id}
                  value={fullName}
                  onSelect={() => handleSelectAssignee(contact.id)}
                >
                  <User className="h-4 w-4" />
                  {fullName}
                  {isSelected && <Check className="text-primary" />}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {mode === 'commands' && (
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
                <CommandShortcut>Alt V</CommandShortcut>
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading={t('sort.title')}>
              {hasActiveSort && (
                <CommandItem onSelect={handleClearSort}>
                  <X />
                  {t('sort.none')}
                </CommandItem>
              )}
              <CommandItem onSelect={() => handleSetSort('deadline', 'asc')}>
                <CalendarIcon />
                <ArrowUp className="h-3 w-3" />
                {t('sort.deadlineAsc')}
                {sortConfig.deadline === 'asc' && <Check className="text-primary" />}
              </CommandItem>
              <CommandItem onSelect={() => handleSetSort('deadline', 'desc')}>
                <CalendarIcon />
                <ArrowDown className="h-3 w-3" />
                {t('sort.deadlineDesc')}
                {sortConfig.deadline === 'desc' && <Check className="text-primary" />}
              </CommandItem>
              <CommandItem onSelect={() => handleSetSort('assignee', 'asc')}>
                <User />
                <ArrowUp className="h-3 w-3" />
                {t('sort.assigneeAsc')}
                {sortConfig.assignee === 'asc' && <Check className="text-primary" />}
              </CommandItem>
              <CommandItem onSelect={() => handleSetSort('assignee', 'desc')}>
                <User />
                <ArrowDown className="h-3 w-3" />
                {t('sort.assigneeDesc')}
                {sortConfig.assignee === 'desc' && <Check className="text-primary" />}
              </CommandItem>
              <CommandItem onSelect={() => handleSetSort('category', 'asc')}>
                <Layers />
                <ArrowUp className="h-3 w-3" />
                {t('sort.categoryAsc')}
                {sortConfig.category === 'asc' && <Check className="text-primary" />}
              </CommandItem>
              <CommandItem onSelect={() => handleSetSort('category', 'desc')}>
                <Layers />
                <ArrowDown className="h-3 w-3" />
                {t('sort.categoryDesc')}
                {sortConfig.category === 'desc' && <Check className="text-primary" />}
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading={t('taskStatus.title')}>
              <CommandItem onSelect={() => { onTaskStatusFilterChange?.('active'); closeWithoutFocusRestore(); }}>
                <CircleDot />
                {t('taskStatus.active')}
                {taskStatusFilter === 'active' && !showOverdueOnly && <Check className="text-primary" />}
              </CommandItem>
              {hasCompletedTasks && (
                <CommandItem onSelect={() => { onTaskStatusFilterChange?.('completed'); closeWithoutFocusRestore(); }}>
                  <CheckCircle2 />
                  {t('taskStatus.completed')}
                  {taskStatusFilter === 'completed' && <Check className="text-primary" />}
                </CommandItem>
              )}
              {hasDeletedTasks && (
                <CommandItem onSelect={() => { onTaskStatusFilterChange?.('deleted'); closeWithoutFocusRestore(); }}>
                  <Trash2 />
                  {t('taskStatus.deleted')}
                  {taskStatusFilter === 'deleted' && <Check className="text-primary" />}
                </CommandItem>
              )}
              <CommandItem onSelect={() => { onShowOverdueOnlyChange?.(!showOverdueOnly); closeWithoutFocusRestore(); }}>
                <AlertTriangle />
                {t('taskStatus.overdue')}
                {showOverdueOnly && <Check className="text-primary" />}
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

            {contacts.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading={t('filterByAssignee')}>
                  {selectedAssignees.length > 0 && (
                    <CommandItem onSelect={handleClearAssignees}>
                      <X />
                      {t('clearAssigneeFilter')}
                    </CommandItem>
                  )}
                  {contacts.map((contact) => {
                    const isSelected = selectedAssignees.includes(contact.id);
                    const fullName = `${contact.name} ${contact.lastname}`.trim();
                    return (
                      <CommandItem
                        key={contact.id}
                        value={fullName}
                        onSelect={() => handleSelectAssignee(contact.id)}
                      >
                        <User className="h-4 w-4" />
                        {fullName}
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
