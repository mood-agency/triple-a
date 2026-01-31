import "@blocknote/core/fonts/inter.css";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/shadcn/style.css";
import { NotepadBlock } from "../components/blocknote/NotepadBlock";
import { defaultBlockSpecs, BlockNoteSchema } from "@blocknote/core";
import { useMemo } from "react";

export const BlockNotePoC = () => {
    const schema = useMemo(() => {
        return BlockNoteSchema.create({
            blockSpecs: {
                ...defaultBlockSpecs,
                notepad: (NotepadBlock as any)(),
            },
        });
    }, []);

    const editor = useCreateBlockNote({
        schema,
        placeholders: {
            default: "",
        },
        initialContent: [
            {
                type: "paragraph",
                content: "Welcome to the BlockNote Notepad PoC! Use Up/Down arrows to test navigation.",
            },
            {
                type: "notepad",
                content: "Task 1: Try moving the cursor up and down",
                props: { labels: ["Urgent"], assignees: ["Argen"] }
            },
            {
                type: "notepad",
                content: "Task 2: The caret should land here, not on the checkbox",
                props: { labels: ["UI"], assignees: ["John"] }
            },
            {
                type: "notepad",
                content: "Task 3: Checkbox should be skipped",
                props: { labels: ["Bug"], assignees: ["Argen", "Jane"] }
            },
            {
                type: "notepad",
                content: "Task 4: This is the fourth task",
                props: { labels: ["Feature"], assignees: ["Doe"] }
            },
            {
                type: "notepad",
                content: "Task 5: Final task for testing",
            },
        ],
    });

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">BlockNote Task PoC</h1>
            <div className="border rounded-lg shadow-sm bg-white min-h-[500px]">
                <BlockNoteView
                    editor={editor}
                    theme="light"
                    formattingToolbar={false}
                    slashMenu={false}
                    sideMenu={false}
                />
            </div>
        </div>
    );
};
