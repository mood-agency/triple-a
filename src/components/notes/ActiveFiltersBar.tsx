import { X, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { NoteCategory, Label } from '@/types/note';
import type { Contact } from '@/types/contact';

interface ActiveFiltersBarProps {
  categoryFilter: NoteCategory | 'all';
  labelFilter: string[];
  assigneeFilter: string[];
  labels: Label[];
  contacts: Contact[];
  onClearCategory: () => void;
  onClearLabel: (labelId: string) => void;
  onClearAssignee: (assigneeId: string) => void;
  onClearAll: () => void;
}

export function ActiveFiltersBar({
  categoryFilter,
  labelFilter,
  assigneeFilter,
  labels,
  contacts,
  onClearCategory,
  onClearLabel,
  onClearAssignee,
  onClearAll,
}: ActiveFiltersBarProps) {
  const { t } = useTranslation();

  const hasFilters = categoryFilter !== 'all' || labelFilter.length > 0 || assigneeFilter.length > 0;

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
    <div className="flex items-center gap-2 px-1 py-2 flex-wrap">
      <span className="text-xs text-muted-foreground font-medium">
        {t('activeFilters')}:
      </span>

      {categoryFilter !== 'all' && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-normal rounded-full bg-secondary text-secondary-foreground">
          {t('filterByCategory')}: {getCategoryLabel(categoryFilter)}
          <button
            type="button"
            onClick={onClearCategory}
            className="rounded-full hover:bg-muted-foreground/20 p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      )}

      {/* Labels - colored background with white text (same style as task labels) */}
      {selectedLabels.map(label => (
        <span
          key={label.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-normal rounded-full text-white"
          style={{ backgroundColor: label.color }}
        >
          {label.name}
          <button
            type="button"
            onClick={() => onClearLabel(label.id)}
            className="rounded-full hover:bg-white/20 p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}

      {/* Assignees - white/transparent background with border */}
      {selectedAssignees.map(contact => {
        const fullName = `${contact.name} ${contact.lastname}`.trim();
        return (
          <span
            key={contact.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-normal rounded-full border border-border bg-background text-foreground"
          >
            <User className="h-3 w-3" />
            {fullName}
            <button
              type="button"
              onClick={() => onClearAssignee(contact.id)}
              className="rounded-full hover:bg-muted p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        );
      })}

      {(categoryFilter !== 'all' || labelFilter.length > 0 || assigneeFilter.length > 0) && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
        >
          {t('clearAllFilters')}
        </button>
      )}
    </div>
  );
}
