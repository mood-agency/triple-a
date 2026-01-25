import { useTranslation } from 'react-i18next';
import { Pin, PanelRightOpen, RotateCcw, Trash2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Note } from '@/types/note';

interface NoteRowActionsProps {
    note: Note;
    isFixedInSidebar: boolean;
    isDeleted: boolean;
    onTogglePinned: (id: string, pinned: boolean) => void;
    onToggleFixInSidebar?: (id: string) => void;
    onRestore?: () => void;
    onDeleteClick: (e: React.MouseEvent) => void;
}

export function NoteRowActions({
    note,
    isFixedInSidebar,
    isDeleted,
    onTogglePinned,
    onToggleFixInSidebar,
    onRestore,
    onDeleteClick,
}: NoteRowActionsProps) {
    const { t } = useTranslation();

    return (
        <div className={`flex items-center gap-0.5 pl-1 shrink-0 transition-opacity ${note.pinned || isFixedInSidebar ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            {!note.completed && !isDeleted && (
                <>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                className={`p-1 cursor-pointer transition-opacity ${note.pinned ? 'text-primary' : 'text-muted-foreground/60 hover:text-primary'}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onTogglePinned(note.id, !note.pinned);
                                }}
                            >
                                <Pin className="h-3.5 w-3.5" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{note.pinned ? t('unpin') : t('pin')}</p>
                        </TooltipContent>
                    </Tooltip>
                    {onToggleFixInSidebar && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    className={`p-1 cursor-pointer transition-opacity ${isFixedInSidebar ? 'text-blue-500' : 'text-muted-foreground/60 hover:text-blue-500'}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleFixInSidebar?.(note.id);
                                    }}
                                >
                                    <PanelRightOpen className="h-3.5 w-3.5" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{isFixedInSidebar ? t('unfixFromSidebar') : t('fixToSidebar')}</p>
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
                            className="p-1 cursor-pointer text-muted-foreground/60 hover:text-primary"
                            onClick={(e) => {
                                e.stopPropagation();
                                onRestore();
                            }}
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
                            className="p-1 cursor-pointer text-muted-foreground/60 hover:text-destructive"
                            onClick={onDeleteClick}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{t('deleteTask')}</p>
                    </TooltipContent>
                </Tooltip>
            )}
        </div>
    );
}
