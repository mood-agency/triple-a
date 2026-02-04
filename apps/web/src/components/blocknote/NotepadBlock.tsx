import { defaultProps } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useBlockCommands } from "./hooks/useBlockCommands";
import { Pickaxe, Users, Forward, StickyNote, Pin, SidebarClose, Trash2 } from "lucide-react";
import { parseLocalDate, formatRelativeDateEnhanced } from "@/utils/dateUtils";
import i18n from "@/i18n";
import { LazyTooltip } from "@/components/ui/lazy-tooltip";
import { eventBus } from "@/events";
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
        },
        content: "inline",
    },
    {
        render: (props: any) => {
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
                // Emit event to parent component
                eventBus.emit('note:completed', {
                    noteId: props.block.id,
                    completed: !isChecked,
                    completedAt: !isChecked ? new Date().toISOString() : null,
                });

                // Update block state
                props.editor.updateBlock(props.block, {
                    props: { ...props.block.props, isChecked: !isChecked }
                } as any);
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

            // Format deadline display as days with decimals
            const formatDeadline = (deadline: string) => {
                if (!deadline) return '';

                const deadlineDate = parseLocalDate(deadline);
                const now = new Date();
                const diffMs = deadlineDate.getTime() - now.getTime();
                const diffDays = diffMs / (1000 * 60 * 60 * 24);

                // Handle -0.0 case by using 0
                const normalizedDays = Object.is(diffDays, -0) || (diffDays > -0.05 && diffDays < 0.05) ? 0 : diffDays;

                // Format with 1 decimal place, show + for positive values
                const formatted = normalizedDays.toFixed(1);
                const daysUnit = i18n.t('date.daysShort');
                return normalizedDays >= 0 ? `+${formatted}${daysUnit}` : `${formatted}${daysUnit}`;
            };

            // Format human-friendly date for tooltip
            const formatHumanFriendlyDate = (deadline: string) => {
                if (!deadline) return '';

                const date = parseLocalDate(deadline);
                const translations = {
                    today: i18n.t('date.today'),
                    tomorrow: i18n.t('date.tomorrow'),
                    yesterday: i18n.t('date.yesterday'),
                    inDays: i18n.t('date.inDays'),
                    daysAgo: i18n.t('date.daysAgo'),
                    inAWeek: i18n.t('date.inAWeek'),
                    aWeekAgo: i18n.t('date.aWeekAgo'),
                    inWeeks: i18n.t('date.inWeeks'),
                    weeksAgo: i18n.t('date.weeksAgo'),
                    nextWeek: i18n.t('date.nextWeek'),
                    lastWeek: i18n.t('date.lastWeek'),
                    thisWeekday: i18n.t('date.thisWeekday'),
                    nextWeekday: i18n.t('date.nextWeekday'),
                    lastWeekday: i18n.t('date.lastWeekday'),
                    inAMonth: i18n.t('date.inAMonth'),
                    aMonthAgo: i18n.t('date.aMonthAgo'),
                    inMonths: i18n.t('date.inMonths'),
                    monthsAgo: i18n.t('date.monthsAgo'),
                    inAYear: i18n.t('date.inAYear'),
                    aYearAgo: i18n.t('date.aYearAgo'),
                    inYears: i18n.t('date.inYears'),
                    yearsAgo: i18n.t('date.yearsAgo'),
                };

                const relativeStr = formatRelativeDateEnhanced(date, i18n.language, translations, false);

                // Show time when referring to a specific day (within ±7 days) and it's not an all-day task
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const targetDate = new Date(date);
                targetDate.setHours(0, 0, 0, 0);
                const daysDiff = Math.round((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                // Check if it's an all-day task using the explicit field
                const isAllDay = props.block.props.isAllDay as boolean;

                if (Math.abs(daysDiff) <= 7 && !isAllDay) {
                    const timeStr = date.toLocaleTimeString(i18n.language, {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    return `${relativeStr} ${timeStr}`;
                }

                return relativeStr;
            };

            // Check if deadline has passed
            const isPastDeadline = dateStr ? parseLocalDate(dateStr) < new Date() : false;
            const shouldShowRed = isPastDeadline && !isChecked && category !== 'meeting';

            // Only show checkbox for todo and followup categories
            const allowsCheckbox = category === 'todo' || category === 'followup';

            return (
                <div className="notepad-line group" style={{ display: "flex", alignItems: "center", width: "100%", userSelect: "none", outline: "none", boxShadow: "none" }}>
                    {!isCompact && (
                        <div contentEditable={false} className="notepad-category-checkbox relative flex items-center justify-center w-6 h-4 mr-2 flex-shrink-0 cursor-pointer">
                            {/* Category Icon (Visible by default, fades on hover only if checkbox is allowed) */}
                            <div
                                className={`category-icon transition-opacity duration-200 ${allowsCheckbox ? 'group-hover:opacity-0' : ''}`}
                                onClick={cycleCategory}
                            >
                                <CategoryIcon size={16} className="text-gray-500" />
                            </div>

                            {/* Checkbox (Visible on hover only for todo and followup) */}
                            {allowsCheckbox && (
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                    <input
                                        type="checkbox"
                                        className="cursor-pointer w-3 h-3"
                                        checked={isChecked}
                                        onChange={handleToggleCompleted}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    <div
                        ref={combinedRef}
                        className={`notepad-content text-black dark:text-white ${props.block.props.isChecked ? 'is-checked' : ''} ${isEditing ? 'is-editing' : ''}`}
                        style={{
                            outline: "none",
                            userSelect: "text",
                        }}
                    />

                    <div contentEditable={false} className="notepad-metadata flex gap-1 mx-2 flex-shrink-0">
                        {(props.block.props.labels as Array<{ name: string; color: string }>)?.map((label, i: number) => (
                            <span
                                key={i}
                                className="chip-label"
                                style={{ backgroundColor: label.color }}
                            >
                                {label.name}
                            </span>
                        ))}
                        {category !== 'notes' && (props.block.props.assignees as any[])?.length > 0 && (
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
                    </div>

                    {dateStr && !hideDate && (
                        <LazyTooltip content={formatHumanFriendlyDate(dateStr)} delayDuration={300}>
                            <span
                                contentEditable={false}
                                className={`chip-deadline cursor-default ${shouldShowRed ? 'chip-deadline-overdue' : ''}`}
                                style={{ userSelect: "none" }}
                            >
                                {formatDeadline(dateStr)}
                            </span>
                        </LazyTooltip>
                    )}

                    {/* Pin icon - only render if pinned in compact mode, otherwise show on hover */}
                    {(!isCompact || isPinned) && (
                        <LazyTooltip content={isPinned ? "Unpin task" : "Pin task"} delayDuration={300}>
                            <button
                                contentEditable={false}
                                onClick={handleTogglePin}
                                className={`p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-all ml-auto flex-shrink-0 ${isPinned
                                    ? 'opacity-100'
                                    : 'opacity-0 group-hover:opacity-100'
                                    }`}
                                style={{ userSelect: "none", display: (isCompact && !isPinned) ? "none" : undefined }}
                            >
                                <Pin size={14} className={isPinned ? "text-black dark:text-white" : "text-gray-600 dark:text-gray-400"} />
                            </button>
                        </LazyTooltip>
                    )}

                    {/* Sidebar icon - only render if fixed in compact mode, otherwise show on hover */}
                    {(!isCompact || isFixedInSidebar) && (
                        <LazyTooltip content={isFixedInSidebar ? "Unfix from sidebar" : "Fix to sidebar"} delayDuration={300}>
                            <button
                                contentEditable={false}
                                onClick={handleToggleFixInSidebar}
                                className={`p-1 hover:bg-gray-200 rounded transition-all flex-shrink-0 ${isFixedInSidebar
                                    ? 'opacity-100'
                                    : 'opacity-0 group-hover:opacity-100'
                                    }`}
                                style={{ userSelect: "none", display: (isCompact && !isFixedInSidebar) ? "none" : undefined }}
                            >
                                <SidebarClose size={14} className={isFixedInSidebar ? "text-blue-600" : "text-gray-600"} />
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
                            <LazyTooltip content="Delete" delayDuration={300}>
                                <button
                                    onClick={handleDelete}
                                    className="p-1 hover:bg-red-100 rounded transition-colors"
                                >
                                    <Trash2 size={14} className="text-red-600" />
                                </button>
                            </LazyTooltip>
                        </div>
                    )}
                </div>
            );
        },
    }
);
