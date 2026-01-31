import { defaultProps } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useBlockCommands } from "./hooks/useBlockCommands";
import { ListTodo, Users, Repeat2, FileText } from "lucide-react";
import "./NotepadBlock.css";

const CATEGORIES = ["todo", "meeting", "follow-up", "note"] as const;
type Category = (typeof CATEGORIES)[number];

const categoryIcons: Record<Category, any> = {
    "todo": ListTodo,
    "meeting": Users,
    "follow-up": Repeat2,
    "note": FileText,
};

export const NotepadBlock = createReactBlockSpec(
    {
        type: "notepad",
        propSchema: {
            ...defaultProps,
            isChecked: { default: false },
            category: { default: "todo" },
            date: { default: "22 de noviembre 2026" },
            labels: { default: [] as string[] },
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
            const CategoryIcon = categoryIcons[category] || ListTodo;

            const cycleCategory = (e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                const currentIndex = CATEGORIES.indexOf(category);
                const nextIndex = (currentIndex + 1) % CATEGORIES.length;
                props.editor.updateBlock(props.block, {
                    props: { ...props.block.props, category: CATEGORIES[nextIndex] }
                } as any);
            };

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
                                checked={props.block.props.isChecked as boolean}
                                onChange={() => props.editor.updateBlock(props.block, {
                                    props: { ...props.block.props, isChecked: !props.block.props.isChecked }
                                } as any)}
                            />
                        </div>
                    </div>

                    <div
                        ref={combinedRef}
                        className={`notepad-content text-black dark:text-black ${props.block.props.isChecked ? 'is-checked' : ''} ${isEditing ? 'is-editing' : ''}`}
                        style={{ outline: "none", userSelect: "text" }}
                    />

                    <div contentEditable={false} className="flex gap-1 mx-2 flex-shrink-0 pointer-events-none">
                        {(props.block.props.labels as string[])?.map((label: string, i: number) => (
                            <Badge key={i} variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 px-1.5 py-0 whitespace-nowrap">
                                {label}
                            </Badge>
                        ))}
                        {(props.block.props.assignees as string[])?.map((assignee: string, i: number) => (
                            <Badge key={i} variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 px-1.5 py-0 whitespace-nowrap">
                                {assignee}
                            </Badge>
                        ))}
                    </div>

                    <div
                        contentEditable={false}
                        className="flex-shrink-0"
                        style={{
                            marginLeft: "8px",
                            color: "#888",
                            whiteSpace: "nowrap",
                            userSelect: "none",
                            pointerEvents: "none"
                        }}
                    >
                        ({props.block.props.date as string})
                    </div>
                </div>
            );
        },
    }
);
