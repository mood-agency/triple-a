import { defaultProps } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useBlockCommands } from "./hooks/useBlockCommands";
import { Pickaxe, Users, Forward, StickyNote, Pin, SidebarClose, Trash2 } from "lucide-react";
import { parseLocalDate } from "@/utils/dateUtils";
import i18n from "@/i18n";
import "./NotepadBlock.css";

const CATEGORIES = ["todo", "meeting", "followup", "notes"] as const;
type Category = (typeof CATEGORIES)[number];

const categoryIcons: Record<Category, any> = {
    "todo": Pickaxe,
    "meeting": Users,
    "followup": Forward,
    "notes": StickyNote,
};

export const NotepadBlock = createReactBlockSpec(
    {
        type: "notepad",
        propSchema: {
            ...defaultProps,
            isChecked: { default: false },
            category: { default: "todo" },
            date: { default: "22 de noviembre 2026" },
            labels: { default: [] as Array<{ name: string; color: string }> },
            assignees: { default: [] as string[] },
        },
        content: "inline",
    },
    {
        render: (props) => {
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
                const checkSelection = () => {
                    const textCursorPosition = props.editor.getTextCursorPosition();
                    const isThisBlockSelected = textCursorPosition.block.id === props.block.id;
                    setIsEditing(isThisBlockSelected);

                    // Prevent multi-block selection
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
                            props.editor._tiptapEditor.state.selection.constructor.create(
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

                const date = parseLocalDate(deadline);
                const today = new Date();
                const isToday = date.getDate() === today.getDate() &&
                               date.getMonth() === today.getMonth() &&
                               date.getFullYear() === today.getFullYear();

                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                const isTomorrow = date.getDate() === tomorrow.getDate() &&
                                  date.getMonth() === tomorrow.getMonth() &&
                                  date.getFullYear() === tomorrow.getFullYear();

                let dateText = '';
                if (isToday) dateText = 'Today';
                else if (isTomorrow) dateText = 'Tomorrow';
                else dateText = date.toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' });

                // Add time if it's not midnight (all-day events)
                if (deadline.includes('T')) {
                    const d = parseLocalDate(deadline);
                    if (!(d.getHours() === 0 && d.getMinutes() === 0)) {
                        dateText += ` ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
                    }
                }

                return dateText;
            };

            // Check if deadline has passed
            const isPastDeadline = dateStr ? parseLocalDate(dateStr) < new Date() : false;
            const shouldShowRed = isPastDeadline && !isChecked && category !== 'meeting';

            return (
                <div className="notepad-line group" style={{ display: "flex", alignItems: "center", width: "100%", userSelect: "none", outline: "none", boxShadow: "none" }}>
                    <div contentEditable={false} className="relative flex items-center justify-center w-6 h-6 mr-2 flex-shrink-0 cursor-pointer">
                        {/* Category Icon (Visible by default) */}
                        <div
                            className="category-icon group-hover:opacity-0 transition-opacity duration-200"
                            onClick={cycleCategory}
                        >
                            <CategoryIcon size={18} className="text-gray-500" />
                        </div>

                        {/* Checkbox (Visible on hover) */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <input
                                type="checkbox"
                                className="cursor-pointer w-4 h-4"
                                checked={isChecked}
                                onChange={handleToggleCompleted}
                            />
                        </div>
                    </div>

                    <div
                        ref={combinedRef}
                        className={`notepad-content text-black dark:text-black ${props.block.props.isChecked ? 'is-checked' : ''} ${isEditing ? 'is-editing' : ''}`}
                        style={{ outline: "none", userSelect: "text" }}
                    />

                    <div contentEditable={false} className="flex gap-1 mx-2 flex-shrink-0">
                        {(props.block.props.labels as Array<{ name: string; color: string }>)?.map((label, i: number) => (
                            <span
                                key={i}
                                className="chip-label"
                                style={{ backgroundColor: label.color }}
                            >
                                {label.name}
                            </span>
                        ))}
                        {(props.block.props.assignees as string[])?.map((assignee: string, i: number) => (
                            <span key={i} className="chip-assignee">
                                {assignee}
                            </span>
                        ))}
                    </div>

                    {dateStr && (
                        <div
                            contentEditable={false}
                            className={`flex-shrink-0 text-[10px] whitespace-nowrap ${
                                shouldShowRed ? 'text-red-500 font-medium' : 'text-muted-foreground'
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

                    {/* Action icons - visible on hover */}
                    <div
                        contentEditable={false}
                        className="flex gap-1 ml-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                        style={{ userSelect: "none" }}
                    >
                        <button
                            onClick={handleTogglePin}
                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                            title="Pin task"
                        >
                            <Pin size={14} className="text-gray-600" />
                        </button>
                        <button
                            onClick={handleToggleFixInSidebar}
                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                            title="Fix to sidebar"
                        >
                            <SidebarClose size={14} className="text-gray-600" />
                        </button>
                        <button
                            onClick={handleDelete}
                            className="p-1 hover:bg-red-100 rounded transition-colors"
                            title="Delete"
                        >
                            <Trash2 size={14} className="text-red-600" />
                        </button>
                    </div>
                </div>
            );
        },
    }
);
