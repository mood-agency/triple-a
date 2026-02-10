import { defaultProps } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useBlockCommands } from "./hooks/useBlockCommands";
import { Pickaxe, Users, Forward, StickyNote, Pin, SidebarClose, Trash2, Calendar } from "lucide-react";
import { parseLocalDate, formatRelativeDateEnhanced, getEffectiveDeadline, getDateTranslations, startOfDay } from "@/utils/dateUtils";
import { useTranslation } from "react-i18next";
import { LazyTooltip } from "@/components/ui/lazy-tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Kbd } from "@/components/ui/kbd";
import { eventBus } from "@/events";
import { CATEGORY_CONFIG } from "@/constants/notes";
import "./NotepadBlock.css";

// Debug flag - set to true to enable console logs for debugging
const DEBUG_BLOCKNOTE = false;

const CATEGORIES = ["todo", "meeting", "followup", "notes"] as const;
type Category = (typeof CATEGORIES)[number];

const categoryIcons: Record<Category, any> = {
    "todo": Pickaxe,
    "meeting": Users,
    "followup": Forward,
    "notes": StickyNote,
};

export const NotepadBlock = (createReactBlockSpec as any)(
    {
        type: "notepad",
        propSchema: {
            ...defaultProps,
            isChecked: { default: false },
            category: { default: "todo" },
            date: { default: null as string | null },
            isAllDay: { default: false },
            labels: { default: [] as Array<{ name: string; color: string }> },
            assignees: { default: [] as Array<{ initials: string; fullName: string }> },
            pinned: { default: false },
            compact: { default: false },
            fixedInSidebar: { default: false },
            hideDate: { default: false },
            gcalEventId: { default: false },
        },
        content: "inline",
    },
    {
        render: (props: any) => {
            const { t, i18n } = useTranslation();
            const [node, setNode] = useState<HTMLElement | null>(null);
            const [isEditing, setIsEditing] = useState(false);
            const editorRef = useRef(props.editor);
            const blockRef = useRef(props.block);

            // Keep refs up to date
            editorRef.current = props.editor;
            blockRef.current = props.block;

            const combinedRef = useCallback((node: HTMLElement | null) => {
                setNode(node);
                // Call BlockNote's ref
                props.contentRef(node);
            }, [props.contentRef]);

            // OPTIMIZED: Listen to centralized selection event instead of each block having its own listener
            // This reduces O(n) callbacks per selection change to O(1) event + simple ID comparison
            // Note: Saving is handled centrally by BlockNoteNoteList's onSelectionChange listener
            useEffect(() => {
                const blockId = props.block.id;

                const handleSelectionChange = (event: { payload: { selectedBlockId: string | null; previousBlockId: string | null } }) => {
                    const isThisBlockSelected = event.payload.selectedBlockId === blockId;
                    const wasThisBlockSelected = event.payload.previousBlockId === blockId;

                    // Only update state if this block's selection status changed
                    if (isThisBlockSelected !== wasThisBlockSelected) {
                        if (DEBUG_BLOCKNOTE) {
                            if (isThisBlockSelected) {
                                console.log('[NotepadBlock] Block GAINED focus:', blockId);
                            } else {
                                console.log('[NotepadBlock] Block LOST focus:', blockId);
                            }
                        }
                        setIsEditing(isThisBlockSelected);
                    }
                };

                const unsubscribe = eventBus.subscribe('editor:blockSelection', handleSelectionChange);
                return () => unsubscribe();
            }, [props.block.id]);

            // NOTE: Multi-block selection prevention is now handled centrally in BlockNoteNoteList
            // This eliminates the need for per-block onSelectionChange listeners

            // Test DOM focus/blur events
            useEffect(() => {
                if (!node) return;

                const handleFocus = (e: FocusEvent) => {
                    if (DEBUG_BLOCKNOTE) console.log('[DOM] focus event on block:', props.block.id, 'target:', e.target);
                };

                const handleBlur = (e: FocusEvent) => {
                    if (DEBUG_BLOCKNOTE) console.log('[DOM] blur event on block:', props.block.id, 'target:', e.target, 'relatedTarget:', e.relatedTarget);
                };

                const handleFocusIn = (_e: FocusEvent) => {
                    if (DEBUG_BLOCKNOTE) console.log('[DOM] focusin event on block:', props.block.id);
                };

                const handleFocusOut = (e: FocusEvent) => {
                    if (DEBUG_BLOCKNOTE) console.log('[DOM] focusout event on block:', props.block.id, 'relatedTarget:', e.relatedTarget);
                };

                node.addEventListener('focus', handleFocus, true);
                node.addEventListener('blur', handleBlur, true);
                node.addEventListener('focusin', handleFocusIn);
                node.addEventListener('focusout', handleFocusOut);

                return () => {
                    node.removeEventListener('focus', handleFocus, true);
                    node.removeEventListener('blur', handleBlur, true);
                    node.removeEventListener('focusin', handleFocusIn);
                    node.removeEventListener('focusout', handleFocusOut);
                };
            }, [node, props.block.id]);

            // Reset scroll position when unfocusing
            useEffect(() => {
                if (!isEditing && node) {
                    // Scroll to the beginning when unfocusing
                    node.scrollLeft = 0;
                    // Also reset scroll on all child elements
                    const children = node.querySelectorAll('*');
                    children.forEach((child) => {
                        if (child instanceof HTMLElement) {
                            child.scrollLeft = 0;
                        }
                    });
                }
            }, [isEditing, node]);

            // Use Command Pattern for keyboard handling
            // Using 'as any' for block because BlockNote has strict typing for custom blocks
            useBlockCommands(node, editorRef.current, blockRef.current as any);

            // Animation state for task completion
            const [isCompleting, setIsCompleting] = useState(false);

            const category = (props.block.props.category as Category) || "todo";
            const CategoryIcon = categoryIcons[category] || Pickaxe;
            const isChecked = props.block.props.isChecked as boolean;
            const dateStr = props.block.props.date as string;
            const isPinned = props.block.props.pinned as boolean;
            const isFixedInSidebar = props.block.props.fixedInSidebar as boolean;
            const hideDate = props.block.props.hideDate as boolean;
            const isCompact = props.block.props.compact as boolean;

            const cycleCategory = (e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                const currentIndex = CATEGORIES.indexOf(category);
                const nextIndex = (currentIndex + 1) % CATEGORIES.length;
                props.editor.updateBlock(props.block, {
                    props: { ...props.block.props, category: CATEGORIES[nextIndex] }
                } as any);
            };

            const handleToggleCompleted = () => {
                if (!isChecked) {
                    // Completing: animate first, then emit event after animation
                    setIsCompleting(true);
                    setTimeout(() => {
                        eventBus.emit('note:completed', {
                            noteId: props.block.id,
                            completed: true,
                            completedAt: new Date().toISOString(),
                        });
                        // No need to updateBlock(isChecked: true) here —
                        // the event handler removes the block from the editor
                    }, 600);
                } else {
                    // Uncompleting: emit immediately
                    eventBus.emit('note:completed', {
                        noteId: props.block.id,
                        completed: false,
                        completedAt: null,
                    });
                    props.editor.updateBlock(props.block, {
                        props: { ...props.block.props, isChecked: false }
                    } as any);
                }
            };

            const handleTogglePin = (e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                eventBus.emit('note:pinned', {
                    noteId: props.block.id,
                    pinned: !isPinned,
                });
            };

            const handleToggleFixInSidebar = (e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                eventBus.emit('note:fixedInSidebar', {
                    noteId: props.block.id,
                    fixedInSidebar: !isFixedInSidebar,
                });
            };

            const handleDelete = (e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                eventBus.emit('note:requestDelete', {
                    noteId: props.block.id,
                });
            };

            const translations = getDateTranslations(t);
            const blockIsAllDay = props.block.props.isAllDay as boolean;

            const formatDeadline = (deadline: string) => {
                if (!deadline) return '';
                return formatRelativeDateEnhanced(parseLocalDate(deadline), i18n.language, translations, false, blockIsAllDay);
            };

            const formatHumanFriendlyDate = (deadline: string) => {
                if (!deadline) return '';
                return formatRelativeDateEnhanced(parseLocalDate(deadline), i18n.language, translations, true, blockIsAllDay);
            };

            // Check if deadline has passed (all-day tasks use end-of-day)
            const isPastDeadline = dateStr ? getEffectiveDeadline(dateStr, blockIsAllDay) < new Date() : false;
            const isToday = dateStr ? startOfDay(parseLocalDate(dateStr)).getTime() === startOfDay(new Date()).getTime() : false;
            const catConfig = CATEGORY_CONFIG[category];
            const shouldShowRed = isPastDeadline && !isChecked && catConfig.showsOverdueRed;
            const allowsCheckbox = catConfig.allowsCheckbox;

            return (
                <div className={`notepad-line group ${isCompleting ? 'is-completing' : ''}`} style={{ display: "flex", alignItems: "center", width: "100%", userSelect: "none", outline: "none", boxShadow: "none" }}>
                    {!isCompact && (
                        <div contentEditable={false} className="notepad-category-checkbox relative flex items-center justify-center w-6 h-4 mr-2 flex-shrink-0 cursor-pointer">
                            {/* Category Icon (Visible by default, fades on hover only if checkbox is allowed, OR if checked/completing) */}
                            <div
                                className={`category-icon transition-opacity duration-200 ${isChecked || isCompleting
                                        ? 'opacity-0 pointer-events-none'
                                        : (allowsCheckbox ? 'group-hover:opacity-0' : '')
                                    }`}
                                onClick={cycleCategory}
                            >
                                <CategoryIcon size={16} className="text-muted-foreground" />
                            </div>

                            {/* Checkbox (Visible on hover only for todo and followup, OR if checked/completing) */}
                            {allowsCheckbox && (
                                <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${isChecked || isCompleting
                                        ? 'opacity-100'
                                        : 'opacity-0 group-hover:opacity-100'
                                    }`}>
                                    <Checkbox
                                        checked={isChecked || isCompleting}
                                        onCheckedChange={() => handleToggleCompleted()}
                                        className={`w-4 h-4 ${isCompleting ? 'completing-checkbox' : ''}`}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    <div
                        ref={combinedRef}
                        className={`notepad-content text-black dark:text-white ${props.block.props.isChecked ? 'is-checked' : ''} ${isCompleting ? 'is-completing' : ''} ${isEditing ? 'is-editing' : ''}`}
                        style={{
                            outline: "none",
                            userSelect: "text",
                        }}
                    />

                    <div contentEditable={false} className="notepad-metadata flex gap-1 mx-2 flex-shrink-0">
                        {dateStr && !hideDate && (
                            <LazyTooltip content={formatHumanFriendlyDate(dateStr)} delayDuration={300}>
                                <span
                                    className={`chip-deadline cursor-pointer ${shouldShowRed ? 'chip-deadline-overdue' : isToday ? 'chip-deadline-today' : ''}`}
                                    style={{ userSelect: "none" }}
                                >
                                    {formatDeadline(dateStr)}
                                </span>
                            </LazyTooltip>
                        )}
                        {catConfig.showsAssignees && (props.block.props.assignees as any[])?.length > 0 && (
                            <LazyTooltip
                                content={(props.block.props.assignees as Array<{ initials: string; fullName: string }>).map(a => a.fullName).join(', ')}
                                delayDuration={300}
                            >
                                <span className="chip-assignee">
                                    {(props.block.props.assignees as Array<{ initials: string; fullName: string }>)
                                        .map(a => a.initials)
                                        .join(' | ')}
                                </span>
                            </LazyTooltip>
                        )}
                        {props.block.props.gcalEventId && (
                            <LazyTooltip content={t('gcal.syncedWithGCal')} delayDuration={300}>
                                <span className="flex items-center text-blue-500">
                                    <Calendar size={12} />
                                </span>
                            </LazyTooltip>
                        )}
                        {(props.block.props.labels as Array<{ name: string; color: string }>)?.map((label, i: number) => (
                            <span
                                key={i}
                                className="chip-label"
                                style={{ backgroundColor: label.color }}
                            >
                                {label.name}
                            </span>
                        ))}
                    </div>

                    {/* Pin icon - only render if pinned in compact mode, otherwise show on hover */}
                    {(!isCompact || isPinned) && (
                        <LazyTooltip content={<span className="flex items-center gap-2">{isPinned ? t('unpin') : t('pin')}<span className="flex items-center gap-0.5"><Kbd>Alt</Kbd><Kbd>X</Kbd></span></span>} delayDuration={300}>
                            <button
                                contentEditable={false}
                                onClick={handleTogglePin}
                                className={`p-1 hover:bg-muted rounded transition-all ml-auto flex-shrink-0 ${isPinned
                                    ? 'opacity-100'
                                    : 'opacity-0 group-hover:opacity-100'
                                    }`}
                                style={{ userSelect: "none", display: (isCompact && !isPinned) ? "none" : undefined }}
                            >
                                <Pin size={14} className={isPinned ? "text-primary" : "text-muted-foreground hover:text-primary"} />
                            </button>
                        </LazyTooltip>
                    )}

                    {/* Sidebar icon - only render if fixed in compact mode, otherwise show on hover */}
                    {(!isCompact || isFixedInSidebar) && (
                        <LazyTooltip content={<span className="flex items-center gap-2">{isFixedInSidebar ? t('unfixFromSidebar') : t('fixToSidebar')}<span className="flex items-center gap-0.5"><Kbd>Alt</Kbd><Kbd>B</Kbd></span></span>} delayDuration={300}>
                            <button
                                contentEditable={false}
                                onClick={handleToggleFixInSidebar}
                                className={`p-1 hover:bg-muted rounded transition-all flex-shrink-0 ${isFixedInSidebar
                                    ? 'opacity-100'
                                    : 'opacity-0 group-hover:opacity-100'
                                    }`}
                                style={{ userSelect: "none", display: (isCompact && !isFixedInSidebar) ? "none" : undefined }}
                            >
                                <SidebarClose size={14} className={isFixedInSidebar ? "text-blue-500" : "text-muted-foreground hover:text-blue-500"} />
                            </button>
                        </LazyTooltip>
                    )}

                    {/* Other action icons - hidden in compact mode */}
                    {!isCompact && (
                        <div
                            contentEditable={false}
                            className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                            style={{ userSelect: "none" }}
                        >
                            <LazyTooltip content={<span className="flex items-center gap-2">{t('delete')}<span className="flex items-center gap-0.5"><Kbd>Ctrl</Kbd><Kbd>⌫</Kbd></span></span>} delayDuration={300}>
                                <button
                                    onClick={handleDelete}
                                    className="p-1 hover:bg-destructive/10 rounded transition-colors"
                                >
                                    <Trash2 size={14} className="text-muted-foreground hover:text-destructive" />
                                </button>
                            </LazyTooltip>
                        </div>
                    )}
                </div>
            );
        },
    }
);
