import { useTranslation } from 'react-i18next';
import { Pin, PanelRightOpen, RotateCcw, Trash2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Kbd } from '@/components/ui/kbd';
import type { Note } from '@/types/note';

interface NoteRowActionsProps {
    note: Note;
    isFixedInSidebar: boolean;
    isDeleted: boolean;
    onTogglePinned: (id: string, pinned: boolean) => void;
    onToggleFixInSidebar?: (id: string) => void;
    onRestore?: () => void;
    onDeleteClick: (e: React.MouseEvent) => void;
    compactView?: boolean;
}

const iconBtnBase = "inline-flex items-center justify-center h-6 w-6 rounded-md transition-colors";

export function NoteRowActions({
    note,
    isFixedInSidebar,
    isDeleted,
    onTogglePinned,
    onToggleFixInSidebar,
    onRestore,
    onDeleteClick,
    compactView,
}: NoteRowActionsProps) {
    const { t } = useTranslation();

    return (
        <div className="flex items-center gap-1 shrink-0">
            {!note.completed && !isDeleted && (
                <>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onTogglePinned(note.id, !note.pinned);
                                }}
                                className={`${iconBtnBase} ${note.pinned ? 'text-primary' : (compactView ? 'hidden' : 'opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary')}`}
                            >
                                <Pin className="h-3.5 w-3.5" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent className="flex items-center gap-2">
                            <p>{note.pinned ? t('unpin') : t('pin')}</p>
                            <span className="flex items-center gap-0.5"><Kbd>Alt</Kbd><Kbd>X</Kbd></span>
                        </TooltipContent>
                    </Tooltip>
                    {onToggleFixInSidebar && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleFixInSidebar?.(note.id);
                                    }}
                                    className={`${iconBtnBase} ${isFixedInSidebar ? 'text-blue-500' : (compactView ? 'hidden' : 'opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-blue-500')}`}
                                >
                                    <PanelRightOpen className="h-3.5 w-3.5" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent className="flex items-center gap-2">
                                <p>{isFixedInSidebar ? t('unfixFromSidebar') : t('fixToSidebar')}</p>
                                <span className="flex items-center gap-0.5"><Kbd>Alt</Kbd><Kbd>B</Kbd></span>
                            </TooltipContent>
                        </Tooltip>
                    )}
                </>
            )}
            {isDeleted && onRestore ? (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onRestore();
                            }}
                            className={`${iconBtnBase} ${compactView ? 'hidden' : 'opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary'}`}
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{t('trash.restore')}</p>
                    </TooltipContent>
                </Tooltip>
            ) : (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            onClick={onDeleteClick}
                            className={`${iconBtnBase} ${compactView ? 'hidden' : 'opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive'}`}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent className="flex items-center gap-2">
                        <p>{t('deleteTask')}</p>
                        <span className="flex items-center gap-0.5"><Kbd>Ctrl</Kbd><Kbd>⌫</Kbd></span>
                    </TooltipContent>
                </Tooltip>
            )}
        </div>
    );
}
