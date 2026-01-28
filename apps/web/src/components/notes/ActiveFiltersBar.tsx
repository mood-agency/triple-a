import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { NoteCategory, Label } from '@/types/note';
import type { Contact } from '@/types/contact';

interface ActiveFiltersBarProps {
  categoryFilter: NoteCategory | 'all';
  labelFilter: string[];
  assigneeFilter: string[];
  searchQuery: string;
  labels: Label[];
  contacts: Contact[];
  onClearCategory: () => void;
  onClearLabel: (labelId: string) => void;
  onClearAssignee: (assigneeId: string) => void;
  onClearSearch: () => void;
  onClearAll: () => void;
}

export function ActiveFiltersBar({
  categoryFilter,
  labelFilter,
  assigneeFilter,
  searchQuery,
  labels,
  contacts,
  onClearCategory,
  onClearLabel,
  onClearAssignee,
  onClearSearch,
  onClearAll,
}: ActiveFiltersBarProps) {
  const { t } = useTranslation();

  const trimmedSearch = searchQuery.trim();
  const hasFilters = categoryFilter !== 'all' || labelFilter.length > 0 || assigneeFilter.length > 0 || trimmedSearch !== '';

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
    <div className="flex items-center gap-2 py-1.5 px-3 flex-wrap mr-auto mb-2 rounded-lg border border-muted-foreground/30 bg-muted/50">
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

      {/* Labels - colored background with white text (same style as task labels) */}
      {selectedLabels.map(label => (
        <span
          key={label.id}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded-full text-white leading-none"
          style={{ backgroundColor: label.color }}
        >
          {label.name}
          <button
            type="button"
            onClick={() => onClearLabel(label.id)}
            className="rounded-full hover:bg-white/20"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}

      {/* Assignees - white/transparent background with border (same style as task assignees) */}
      {selectedAssignees.map(contact => {
        const fullName = `${contact.name} ${contact.lastname}`.trim();
        return (
          <span
            key={contact.id}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded-full border border-border bg-background text-muted-foreground leading-none"
          >
            {fullName}
            <button
              type="button"
              onClick={() => onClearAssignee(contact.id)}
              className="rounded-full hover:bg-muted"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        );
      })}

      {(trimmedSearch || categoryFilter !== 'all' || labelFilter.length > 0 || assigneeFilter.length > 0) && (
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
