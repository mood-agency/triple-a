import { SearchX } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface NoteListEmptyStateProps {
    completedCount?: number;
    shouldShowOnlyCompletedMessage: boolean;
    fillHeight?: boolean;
}

export function NoteListEmptyState({
    completedCount,
    shouldShowOnlyCompletedMessage,
    fillHeight = true
}: NoteListEmptyStateProps) {
    const { t } = useTranslation();

    // Special case: filters match only completed tasks (no active tasks)
    const effectiveCompletedCount = completedCount ?? 0;
    const showCompletedMessage = shouldShowOnlyCompletedMessage || (completedCount !== undefined && completedCount > 0);

    const getMessage = () => {
        if (showCompletedMessage) {
            if (effectiveCompletedCount === 1) {
                return t('onlyCompletedTasksSingular');
            }
            return t('onlyCompletedTasks', { count: effectiveCompletedCount });
        }
        return t('noResults');
    };

    return (
        <div className={`flex-1 flex items-center justify-center ${fillHeight ? 'h-full' : ''}`}>
            <div className="flex flex-col items-center justify-center text-muted-foreground/60 p-8">
                <SearchX className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm italic">{getMessage()}</p>
            </div>
        </div>
    );
}
