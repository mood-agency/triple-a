import { Badge } from '@/components/ui/badge';
import { Tag, User, AlertCircle, Pickaxe, Forward, StickyNote, Users as UsersIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { NoteCategory, Label } from '@/types/note';
import type { Contact } from '@/types/contact';

interface NoteListEmptyStateProps {
    searchQuery: string;
    categoryFilter: NoteCategory | 'all';
    labelFilter: string[];
    assigneeFilter: string[];
    showOverdueOnly: boolean;
    completedCount?: number;
    shouldShowOnlyCompletedMessage: boolean;
    labels: Label[];
    contacts: Contact[];
    fillHeight?: boolean;
}

export function NoteListEmptyState({
    searchQuery,
    categoryFilter,
    labelFilter,
    assigneeFilter,
    showOverdueOnly,
    completedCount,
    shouldShowOnlyCompletedMessage,
    labels,
    contacts,
    fillHeight = true
}: NoteListEmptyStateProps) {
    const { t } = useTranslation();

    // Category icons and colors mapping
    const categoryStyles: Record<NoteCategory, { icon: React.ReactNode; className: string }> = {
        todo: { icon: <Pickaxe className="h-3 w-3" />, className: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30' },
        followup: { icon: <Forward className="h-3 w-3" />, className: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30' },
        notes: { icon: <StickyNote className="h-3 w-3" />, className: 'bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-500/30' },
        meeting: { icon: <UsersIcon className="h-3 w-3" />, className: 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30' },
    };

    const renderNoResultsContent = () => {
        // Special case: filters match only completed tasks (no active tasks)
        const effectiveCompletedCount = completedCount ?? 0;
        if (shouldShowOnlyCompletedMessage || (completedCount !== undefined && completedCount > 0)) {
            if (effectiveCompletedCount === 1) {
                return <span>{t('onlyCompletedTasksSingular')}</span>;
            }
            return <span>{t('onlyCompletedTasks', { count: effectiveCompletedCount })}</span>;
        }

        const elements: React.ReactNode[] = [];

        // Search text - bold
        if (searchQuery.trim() !== '') {
            elements.push(
                <span key="search" className="inline-flex items-center gap-1">
                    {t('filterTextPrefix')} <strong className="font-semibold">"{searchQuery}"</strong>
                </span>
            );
        }

        // Category - badge with icon
        if (categoryFilter !== 'all') {
            const categoryName = t(`category${categoryFilter.charAt(0).toUpperCase() + categoryFilter.slice(1)}`);
            const style = categoryStyles[categoryFilter];
            elements.push(
                <span key="category" className="inline-flex items-center gap-1">
                    {t('filterCategoryPrefix')}
                    <Badge className={`${style.className} gap-1`}>
                        {style.icon}
                        {categoryName}
                    </Badge>
                </span>
            );
        }

        // Labels - badges with colors
        if (labelFilter.length > 0) {
            const selectedLabels = labels.filter(l => labelFilter.includes(l.id));
            if (selectedLabels.length > 0) {
                elements.push(
                    <span key="labels" className="inline-flex items-center gap-1 flex-wrap">
                        {t('filterLabelsPrefix')}
                        {selectedLabels.map(label => (
                            <Badge
                                key={label.id}
                                className="gap-1"
                                style={{
                                    backgroundColor: `${label.color}20`,
                                    color: label.color,
                                    borderColor: `${label.color}50`,
                                }}
                            >
                                <Tag className="h-3 w-3" />
                                {label.name}
                            </Badge>
                        ))}
                    </span>
                );
            }
        }

        // Assignees - badges
        if (assigneeFilter.length > 0) {
            const selectedAssignees = contacts.filter(c => assigneeFilter.includes(c.id));
            if (selectedAssignees.length > 0) {
                elements.push(
                    <span key="assignees" className="inline-flex items-center gap-1 flex-wrap">
                        {t('filterAssigneesPrefix')}
                        {selectedAssignees.map(contact => (
                            <Badge
                                key={contact.id}
                                className="bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30 gap-1"
                            >
                                <User className="h-3 w-3" />
                                {`${contact.name} ${contact.lastname}`.trim()}
                            </Badge>
                        ))}
                    </span>
                );
            }
        }

        // Overdue only - badge
        if (showOverdueOnly) {
            elements.push(
                <span key="overdue" className="inline-flex items-center gap-1">
                    <Badge className="bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30 gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {t('filterOverdueOnly')}
                    </Badge>
                </span>
            );
        }

        if (elements.length === 0) {
            return <span>{t('noNotesWithFilters')} {t('filterApplied')}</span>;
        }

        return (
            <span className="inline-flex items-center gap-1.5 flex-wrap justify-center">
                {t('noNotesWithFilters')}:
                {elements.map((el, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1">
                        {idx > 0 && <span className="text-muted-foreground/50">,</span>}
                        {el}
                    </span>
                ))}
            </span>
        );
    };

    const content = renderNoResultsContent();

    if (fillHeight) {
        return (
            <div className="flex-1 flex items-center justify-center h-full">
                <p className="text-center text-muted-foreground/60 text-sm italic">
                    {content}
                </p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex items-center justify-center">
            <p className="text-center text-muted-foreground/60 text-sm italic">
                {content}
            </p>
        </div>
    );
}
