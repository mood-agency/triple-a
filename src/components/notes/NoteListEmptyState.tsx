import { Tag, User, AlertCircle, Pickaxe, Forward, StickyNote, Users as UsersIcon, Search } from 'lucide-react';
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

// Small chip component matching the style in NoteRow
function Chip({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
    return (
        <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-full leading-none ${className ?? ''}`}
            style={style}
        >
            {children}
        </span>
    );
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
        todo: { icon: <Pickaxe className="h-2.5 w-2.5" />, className: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30' },
        followup: { icon: <Forward className="h-2.5 w-2.5" />, className: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30' },
        notes: { icon: <StickyNote className="h-2.5 w-2.5" />, className: 'bg-gray-500/20 text-gray-700 dark:text-gray-300 border border-gray-500/30' },
        meeting: { icon: <UsersIcon className="h-2.5 w-2.5" />, className: 'bg-green-500/20 text-green-700 dark:text-green-300 border border-green-500/30' },
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

        const chips: React.ReactNode[] = [];

        // Search text - chip with search icon
        if (searchQuery.trim() !== '') {
            chips.push(
                <Chip key="search" className="bg-secondary text-secondary-foreground border border-border">
                    <Search className="h-2.5 w-2.5" />
                    "{searchQuery}"
                </Chip>
            );
        }

        // Category - chip with icon
        if (categoryFilter !== 'all') {
            const categoryName = t(`category${categoryFilter.charAt(0).toUpperCase() + categoryFilter.slice(1)}`);
            const style = categoryStyles[categoryFilter];
            chips.push(
                <Chip key="category" className={style.className}>
                    {style.icon}
                    {categoryName}
                </Chip>
            );
        }

        // Labels - chips with colors
        if (labelFilter.length > 0) {
            const selectedLabels = labels.filter(l => labelFilter.includes(l.id));
            selectedLabels.forEach(label => {
                chips.push(
                    <Chip
                        key={`label-${label.id}`}
                        className="text-white"
                        style={{ backgroundColor: label.color }}
                    >
                        <Tag className="h-2.5 w-2.5" />
                        {label.name}
                    </Chip>
                );
            });
        }

        // Assignees - chips
        if (assigneeFilter.length > 0) {
            const selectedAssignees = contacts.filter(c => assigneeFilter.includes(c.id));
            selectedAssignees.forEach(contact => {
                chips.push(
                    <Chip
                        key={`assignee-${contact.id}`}
                        className="bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30"
                    >
                        <User className="h-2.5 w-2.5" />
                        {`${contact.name} ${contact.lastname}`.trim()}
                    </Chip>
                );
            });
        }

        // Overdue only - chip
        if (showOverdueOnly) {
            chips.push(
                <Chip key="overdue" className="bg-red-500/20 text-red-700 dark:text-red-300 border border-red-500/30">
                    <AlertCircle className="h-2.5 w-2.5" />
                    {t('filterOverdueOnly')}
                </Chip>
            );
        }

        if (chips.length === 0) {
            return <span>{t('noNotesWithFilters')} {t('filterApplied')}</span>;
        }

        return (
            <span className="inline-flex items-center gap-1 flex-wrap justify-center">
                {t('noNotesWithFilters')}
                {chips}
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
