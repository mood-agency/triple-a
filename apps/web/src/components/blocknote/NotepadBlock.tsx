import { defaultProps } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";

import { TextSelection } from "@tiptap/pm/state";
import "./NotepadBlock.css";

export const NotepadBlock = createReactBlockSpec(
    {
        type: "notepad",
        propSchema: {
            ...defaultProps,
            isChecked: { default: false },
            date: { default: "22 de noviembre 2026" },
            labels: { default: [] as string[] },
            assignees: { default: [] as string[] },
        },
        content: "inline",
    },
    {
        render: (props) => {
            const [node, setNode] = useState<HTMLElement | null>(null);
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

            useEffect(() => {
                if (!node) return;

                const handleKeyDown = (e: KeyboardEvent) => {
                    const editor = editorRef.current;
                    const currentBlock = blockRef.current;
                    if (!editor || !currentBlock) return;

                    const selection = window.getSelection();
                    const anchorNode = selection?.anchorNode;

                    const isInside = (anchorNode && node.contains(anchorNode)) ||
                        node.contains(e.target as Node) ||
                        node.parentElement?.contains(e.target as Node) ||
                        e.target === node;

                    if (isInside) {
                        e.stopImmediatePropagation();

                        const textContent = node.textContent || "";
                        const isEmpty = textContent.trim() === "" || textContent === "\u200B";

                        // Handle Ctrl+A (or Cmd+A) to select only the block text using ProseMirror
                        if (e.key.toLowerCase() === "a" && (e.ctrlKey || e.metaKey)) {
                            console.log("🔹 Ctrl+A pressed - scoping selection (PM)");
                            e.preventDefault();
                            e.stopImmediatePropagation();

                            const tiptapEditor = (editor as any)._tiptapEditor;
                            if (tiptapEditor) {
                                const { state, view } = tiptapEditor;
                                let foundPos = -1;
                                let foundNodeSize = -1;

                                state.doc.descendants((pmNode: any, pos: number) => {
                                    if (pmNode.attrs?.id === currentBlock.id) {
                                        foundPos = pos;
                                        foundNodeSize = pmNode.nodeSize;
                                        return false;
                                    }
                                    return true;
                                });

                                if (foundPos !== -1) {
                                    // Selection range for the block's content
                                    const start = foundPos + 1;
                                    const end = foundPos + foundNodeSize - 1;

                                    const tr = state.tr.setSelection(TextSelection.create(state.doc, start, end));
                                    view.dispatch(tr);
                                    view.focus();
                                }
                            }
                            return;
                        }

                        if (e.key === "Enter") {
                            e.preventDefault();
                            e.stopPropagation();
                            const insertedBlocks = editor.insertBlocks(
                                [{ type: "notepad", props: { date: new Date().toLocaleDateString() } as any }],
                                currentBlock,
                                "after"
                            );
                            if (insertedBlocks.length > 0) {
                                editor.setTextCursorPosition(insertedBlocks[0], "start");
                            }
                            return;
                        }

                        if (e.key === "Backspace" && (isEmpty || e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            e.stopPropagation();

                            const cursorInfo = editor.getTextCursorPosition();
                            const prevBlock = cursorInfo?.prevBlock;
                            const nextBlock = cursorInfo?.nextBlock;

                            if (prevBlock) {
                                editor.setTextCursorPosition(prevBlock, "end");
                            } else if (nextBlock) {
                                editor.setTextCursorPosition(nextBlock, "start");
                            }

                            if (!prevBlock && !nextBlock) {
                                editor.updateBlock(currentBlock, { type: "paragraph" } as any);
                            } else {
                                editor.removeBlocks([currentBlock]);
                            }
                        }
                    }
                };

                document.addEventListener("keydown", handleKeyDown, { capture: true });
                return () => {
                    document.removeEventListener("keydown", handleKeyDown, { capture: true });
                };
            }, [node, props.block.id]);

            return (
                <div className="notepad-line" style={{ display: "flex", alignItems: "center", width: "100%", userSelect: "none", outline: "none", boxShadow: "none" }}>
                    <div contentEditable={false} style={{ marginRight: "8px", userSelect: "none" }}>
                        <input
                            type="checkbox"
                            className="cursor-pointer"
                            checked={props.block.props.isChecked as boolean}
                            onChange={() => props.editor.updateBlock(props.block, {
                                props: { ...props.block.props, isChecked: !props.block.props.isChecked }
                            } as any)}
                        />
                    </div>

                    <div
                        ref={combinedRef}
                        className={`notepad-content text-black dark:text-black ${props.block.props.isChecked ? 'is-checked' : ''}`}
                        style={{ flexGrow: 1, outline: "none", userSelect: "text" }}
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
