import { defaultProps } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useBlockCommands } from "./hooks/useBlockCommands";
import { Pickaxe, Users, Forward, StickyNote, Pin, SidebarClose, Trash2 } from "lucide-react";
import { parseLocalDate, formatRelativeDateEnhanced } from "@/utils/dateUtils";
import i18n from "@/i18n";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
            date: { default: "22 de noviembre 2026" },
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

            // Track if this block is currently being edited
            useEffect(() => {
                let wasEditing = isEditing;

                const checkSelection = () => {
                    const textCursorPosition = props.editor.getTextCursorPosition();
                    const isThisBlockSelected = textCursorPosition.block.id === props.block.id;

                    // Early return if this block isn't selected and wasn't selected before (optimization)
                    if (!isThisBlockSelected && !wasEditing) {
                        return;
                    }

                    // Log when editing state actually changes (use closure variable to avoid state timing)
                    if (isThisBlockSelected !== wasEditing) {
                        if (isThisBlockSelected) {
                            if (DEBUG_BLOCKNOTE) console.log('[NotepadBlock] Block GAINED focus:', props.block.id);
                        } else {
                            if (DEBUG_BLOCKNOTE) console.log('[NotepadBlock] Block LOST focus:', props.block.id);
                            // Dispatch event to save the block when it loses focus
                            window.dispatchEvent(new CustomEvent('notepad:lostFocus', {
                                detail: { noteId: props.block.id }
                            }));
                        }
                        wasEditing = isThisBlockSelected;
                    }

                    setIsEditing(isThisBlockSelected);

                    // Prevent multi-block selection (only when this block is selected)
                    if (!isThisBlockSelected) {
                        return;
                    }

                    const selection = props.editor._tiptapEditor.state.selection;
                    const { from, to } = selection;

                    // Get the blocks involved in the selection
                    const blocks = props.editor.getSelection()?.blocks || [];

                    // If selection spans multiple blocks, constrain to current block
                    if (blocks.length > 1) {
                        const currentBlockPos = props.editor._tiptapEditor.state.doc.resolve(from);
                        // Find the current block's start and end positions
                        let blockStart = from;
                        let blockEnd = to;

                        // Walk up to find the block node
                        for (let d = currentBlockPos.depth; d > 0; d--) {
                            const node = currentBlockPos.node(d);
                            if (node.type.name === 'blockContainer') {
                                blockStart = currentBlockPos.start(d);
                                blockEnd = currentBlockPos.end(d);
                                break;
                            }
                        }

                        // Constrain selection to current block
                        const tr = props.editor._tiptapEditor.state.tr.setSelection(
                            (selection.constructor as any).create(
                                props.editor._tiptapEditor.state.doc,
                                Math.max(blockStart, from),
                                Math.min(blockEnd, to)
                            )
                        );
                        props.editor._tiptapEditor.view.dispatch(tr);
                    }
                };

                // Check initially
                checkSelection();

                // Listen to selection updates
                const unsubscribe = props.editor.onSelectionChange(checkSelection);
                return () => unsubscribe();
            }, [props.editor, props.block.id]);

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
                // Dispatch custom event to parent component
                window.dispatchEvent(new CustomEvent('notepad:toggleCompleted', {
                    detail: { noteId: props.block.id, completed: !isChecked }
                }));

                // Update block state
                props.editor.updateBlock(props.block, {
                    props: { ...props.block.props, isChecked: !isChecked }
                } as any);
            };

            const handleTogglePin = (e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                window.dispatchEvent(new CustomEvent('notepad:togglePin', {
                    detail: { noteId: props.block.id }
                }));
            };

            const handleToggleFixInSidebar = (e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                window.dispatchEvent(new CustomEvent('notepad:toggleFixInSidebar', {
                    detail: { noteId: props.block.id }
                }));
            };

            const handleDelete = (e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                window.dispatchEvent(new CustomEvent('notepad:delete', {
                    detail: { noteId: props.block.id, reason: 'Deleted via trash icon' }
                }));
            };

            // Format deadline display (same logic as NoteRow)
            const formatDeadline = (deadline: string) => {
                if (!deadline) return '';

                return formatRelativeDateEnhanced(
                    parseLocalDate(deadline),
                    i18n.language,
                    {
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
                    },
                    true
                );
            };

            // Check if deadline has passed
            const isPastDeadline = dateStr ? parseLocalDate(dateStr) < new Date() : false;
            const shouldShowRed = isPastDeadline && !isChecked && category !== 'meeting';

            // Only show checkbox for todo and followup categories
            const allowsCheckbox = category === 'todo' || category === 'followup';

            return (
                <div className="notepad-line group" style={{ display: "flex", alignItems: "center", width: "100%", userSelect: "none", outline: "none", boxShadow: "none" }}>
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
                        {category !== 'notes' && (
                            <TooltipProvider delayDuration={300}>
                                {(props.block.props.assignees as Array<{ initials: string; fullName: string }>)?.map((assignee, i: number) => (
                                    <Tooltip key={i}>
                                        <TooltipTrigger asChild>
                                            <span className="chip-assignee">
                                                {assignee.initials}
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{assignee.fullName}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                ))}
                            </TooltipProvider>
                        )}
                    </div>

                    {dateStr && !hideDate && category !== 'notes' && (
                        <div
                            contentEditable={false}
                            className={`notepad-deadline flex-shrink-0 text-[10px] whitespace-nowrap ${shouldShowRed ? 'text-red-500 font-medium' : 'text-muted-foreground'
                                }`}
                            style={{
                                marginLeft: "8px",
                                userSelect: "none",
                                pointerEvents: "none"
                            }}
                        >
                            {formatDeadline(dateStr)}
                        </div>
                    )}

                    <TooltipProvider delayDuration={300}>
                        {/* Pin icon - always visible when pinned, hover otherwise */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    contentEditable={false}
                                    onClick={handleTogglePin}
                                    className={`p-1 hover:bg-gray-200 rounded transition-all ml-auto flex-shrink-0 ${isPinned
                                        ? 'opacity-100'
                                        : 'opacity-0 group-hover:opacity-100'
                                        }`}
                                    style={{ userSelect: "none" }}
                                >
                                    <Pin size={14} className={isPinned ? "text-black" : "text-gray-600"} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{isPinned ? "Unpin task" : "Pin task"}</p>
                            </TooltipContent>
                        </Tooltip>

                        {/* Sidebar icon - always visible when fixed, hover otherwise */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    contentEditable={false}
                                    onClick={handleToggleFixInSidebar}
                                    className={`p-1 hover:bg-gray-200 rounded transition-all flex-shrink-0 ${isFixedInSidebar
                                        ? 'opacity-100'
                                        : 'opacity-0 group-hover:opacity-100'
                                        }`}
                                    style={{ userSelect: "none" }}
                                >
                                    <SidebarClose size={14} className={isFixedInSidebar ? "text-blue-600" : "text-gray-600"} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{isFixedInSidebar ? "Unfix from sidebar" : "Fix to sidebar"}</p>
                            </TooltipContent>
                        </Tooltip>

                        {/* Other action icons - visible on hover */}
                        <div
                            contentEditable={false}
                            className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                            style={{ userSelect: "none" }}
                        >
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={handleDelete}
                                        className="p-1 hover:bg-red-100 rounded transition-colors"
                                    >
                                        <Trash2 size={14} className="text-red-600" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Delete</p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                    </TooltipProvider>
                </div>
            );
        },
    }
);
