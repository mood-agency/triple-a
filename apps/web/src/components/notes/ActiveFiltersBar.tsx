import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import type { NoteCategory, Label } from '@/types/note';
import type { Contact } from '@/types/contact';
import { UndoRedoIndicator } from './UndoRedoIndicator';
import { useFilterCommandsContext } from './FilterCommandsContext';

interface ActiveFiltersBarProps {
  categoryFilter: NoteCategory | 'all';
  labelFilter: string[];
  assigneeFilter: string[];
  searchQuery: string;
  labels: Label[];
  contacts: Contact[];
  sortConfig: { deadline: 'asc' | 'desc' | null; assignee: 'asc' | 'desc' | null; category: 'asc' | 'desc' | null };
  taskStatusFilter: 'active' | 'completed' | 'deleted';
  showOverdueOnly: boolean;
  onClearCategory: () => void;
  onClearLabel: (labelId: string) => void;
  onClearAssignee: (assigneeId: string) => void;
  onClearSearch: () => void;
  onClearSort: () => void;
  onClearTaskStatus: () => void;
  onClearOverdue: () => void;
  onClearAll: () => void;
}

export function ActiveFiltersBar({
  categoryFilter,
  labelFilter,
  assigneeFilter,
  searchQuery,
  labels,
  contacts,
  sortConfig,
  taskStatusFilter,
  showOverdueOnly,
  onClearCategory,
  onClearLabel,
  onClearAssignee,
  onClearSearch,
  onClearSort,
  onClearTaskStatus,
  onClearOverdue,
  onClearAll,
}: ActiveFiltersBarProps) {
  const { t } = useTranslation();
  const { canUndo, canRedo, lastCommand, undo, redo } = useFilterCommandsContext();

  const trimmedSearch = searchQuery.trim();
  const hasSort = sortConfig.deadline !== null || sortConfig.assignee !== null || sortConfig.category !== null;
  const hasStatusFilter = taskStatusFilter !== 'active';
  const hasFilters = categoryFilter !== 'all' || labelFilter.length > 0 || assigneeFilter.length > 0 || trimmedSearch !== '' || hasSort || hasStatusFilter || showOverdueOnly;

  if (!hasFilters) {
    return null;
  }

  const getCategoryLabel = (category: NoteCategory) => {
    switch (category) {
      case 'todo': return t('categoryTodo');
      case 'followup': return t('categoryFollowUp');
      case 'notes': return t('categoryNotes');
      case 'meeting': return t('categoryMeeting');
      default: return category;
    }
  };

  const selectedLabels = labels.filter(l => labelFilter.includes(l.id));
  const selectedAssignees = contacts.filter(c => assigneeFilter.includes(c.id));

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex items-center gap-2 py-1.5 px-3 flex-wrap mr-auto mb-2 rounded-lg border border-muted-foreground/30 bg-muted/50"
    >
      <UndoRedoIndicator
        canUndo={canUndo}
        canRedo={canRedo}
        lastCommand={lastCommand}
        onUndo={undo}
        onRedo={redo}
      />

      <span className="text-xs text-muted-foreground font-medium">
        {t('activeFilters')}:
      </span>

      {trimmedSearch && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded-full bg-secondary text-secondary-foreground leading-none">
          "{trimmedSearch}"
          <button
            type="button"
            onClick={onClearSearch}
            className="rounded-full hover:bg-muted-foreground/20"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      )}

      {categoryFilter !== 'all' && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded-full bg-secondary text-secondary-foreground leading-none">
          {getCategoryLabel(categoryFilter)}
          <button
            type="button"
            onClick={onClearCategory}
            className="rounded-full hover:bg-muted-foreground/20"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      )}

      {/* Labels - colored background with white text */}
      {selectedLabels.map(label => (
        <span key={label.id} className="chip-label" style={{ backgroundColor: label.color }}>
          {label.name}
          <button type="button" onClick={() => onClearLabel(label.id)} className="chip-label-btn">
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}

      {/* Assignees - border style */}
      {selectedAssignees.map(contact => {
        const fullName = `${contact.name} ${contact.lastname}`.trim();
        return (
          <span key={contact.id} className="chip-assignee">
            {fullName}
            <button type="button" onClick={() => onClearAssignee(contact.id)} className="chip-assignee-btn">
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        );
      })}

      {/* Sort - secondary badge */}
      {hasSort && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded-full bg-secondary text-secondary-foreground leading-none">
          {t('sort.title')}: {[
            sortConfig.deadline && (sortConfig.deadline === 'asc' ? t('sort.deadlineAsc') : t('sort.deadlineDesc')),
            sortConfig.assignee && (sortConfig.assignee === 'asc' ? t('sort.assigneeAsc') : t('sort.assigneeDesc')),
            sortConfig.category && (sortConfig.category === 'asc' ? t('sort.categoryAsc') : t('sort.categoryDesc')),
          ].filter(Boolean).join(', ')}
          <button
            type="button"
            onClick={onClearSort}
            className="rounded-full hover:bg-muted-foreground/20"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      )}

      {/* Task status - secondary badge */}
      {hasStatusFilter && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded-full bg-secondary text-secondary-foreground leading-none">
          {t(`taskStatus.${taskStatusFilter}`)}
          <button
            type="button"
            onClick={onClearTaskStatus}
            className="rounded-full hover:bg-muted-foreground/20"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      )}

      {/* Overdue - secondary badge */}
      {showOverdueOnly && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded-full bg-secondary text-secondary-foreground leading-none">
          {t('overdue')}
          <button
            type="button"
            onClick={onClearOverdue}
            className="rounded-full hover:bg-muted-foreground/20"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      )}

      <button
        type="button"
        onClick={onClearAll}
        className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
      >
        {t('clearAllFilters')}
      </button>
    </motion.div>
  );
}
