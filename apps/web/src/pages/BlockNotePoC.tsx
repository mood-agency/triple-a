import "@blocknote/shadcn/style.css";
import { useState, useMemo } from "react";
import { TimelineBlockNoteList } from "../components/notes/TimelineBlockNoteList";
import { BlockNoteNoteList } from "../components/notes/BlockNoteNoteList";
import type { Note, Label } from "../types/note";
import type { Contact } from "../types/contact";

// Mock data for testing
const mockLabels: Label[] = [
    { id: "1", name: "Urgent", color: "#ef4444", user_id: "test" },
    { id: "2", name: "Feature", color: "#3b82f6", user_id: "test" },
    { id: "3", name: "Bug", color: "#f59e0b", user_id: "test" },
];

const mockContacts: Contact[] = [
    { id: "c1", name: "John", lastname: "Doe", user_id: "test" },
    { id: "c2", name: "Jane", lastname: "Smith", user_id: "test" },
];

// Helper to create a date string at a specific hour today
const todayAt = (hour: number): string => {
    const date = new Date();
    date.setHours(hour, 0, 0, 0);
    return date.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
};

const mockNotes: Note[] = [
    {
        id: "note-1",
        content: "Morning standup meeting",
        category: "meeting",
        completed: false,
        pinned: false,
        deadline: todayAt(9),
        date: new Date().toISOString(),
        user_id: "test",
    },
    {
        id: "note-2",
        content: "Review PR for auth feature",
        category: "todo",
        completed: false,
        pinned: true,
        deadline: todayAt(9),
        date: new Date().toISOString(),
        user_id: "test",
    },
    {
        id: "note-3",
        content: "Fix login bug",
        category: "todo",
        completed: false,
        pinned: false,
        deadline: todayAt(10),
        date: new Date().toISOString(),
        user_id: "test",
    },
    {
        id: "note-4",
        content: "Lunch with team",
        category: "meeting",
        completed: false,
        pinned: false,
        deadline: todayAt(12),
        date: new Date().toISOString(),
        user_id: "test",
    },
    {
        id: "note-5",
        content: "Follow up with client about project",
        category: "followup",
        completed: false,
        pinned: false,
        deadline: todayAt(14),
        date: new Date().toISOString(),
        user_id: "test",
    },
    {
        id: "note-6",
        content: "Code review session",
        category: "meeting",
        completed: false,
        pinned: false,
        deadline: todayAt(15),
        date: new Date().toISOString(),
        user_id: "test",
    },
    {
        id: "note-7",
        content: "Deploy to staging",
        category: "todo",
        completed: true,
        pinned: false,
        deadline: todayAt(16),
        date: new Date().toISOString(),
        user_id: "test",
    },
    {
        id: "note-8",
        content: "All-day task without specific time",
        category: "todo",
        completed: false,
        pinned: false,
        deadline: new Date().toISOString().slice(0, 10), // Just date, no time
        date: new Date().toISOString(),
        user_id: "test",
    },
    {
        id: "note-9",
        content: "Remember to submit weekly report",
        category: "followup",
        completed: false,
        pinned: true,
        deadline: new Date().toISOString().slice(0, 10), // Just date, no time
        date: new Date().toISOString(),
        user_id: "test",
    },
];

// Build caches
const buildNoteLabelsCache = (): Map<string, Label[]> => {
    const cache = new Map<string, Label[]>();
    cache.set("note-1", [mockLabels[0]]);
    cache.set("note-2", [mockLabels[1], mockLabels[0]]);
    cache.set("note-3", [mockLabels[2]]);
    cache.set("note-5", [mockLabels[1]]);
    cache.set("note-9", [mockLabels[0]]); // Urgent label for all-day task
    return cache;
};

const buildNoteAssigneesCache = (): Map<string, Contact[]> => {
    const cache = new Map<string, Contact[]>();
    cache.set("note-1", [mockContacts[0], mockContacts[1]]);
    cache.set("note-3", [mockContacts[0]]);
    cache.set("note-5", [mockContacts[1]]);
    return cache;
};

export const BlockNotePoC = () => {
    const [notes] = useState<Note[]>(mockNotes);
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [view, setView] = useState<"timeline" | "list">("timeline");
    const [hideEmptyHours, setHideEmptyHours] = useState(true);

    const noteLabelsCache = useMemo(() => buildNoteLabelsCache(), []);
    const noteAssigneesCache = useMemo(() => buildNoteAssigneesCache(), []);

    // Note: Handlers removed after CQRS migration - components now use commands internally

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">BlockNote Timeline PoC</h1>

            {/* Controls */}
            <div className="flex gap-4 mb-4">
                <button
                    onClick={() => setView("timeline")}
                    className={`px-4 py-2 rounded ${view === "timeline" ? "bg-blue-500 text-white" : "bg-gray-200"}`}
                >
                    Timeline View
                </button>
                <button
                    onClick={() => setView("list")}
                    className={`px-4 py-2 rounded ${view === "list" ? "bg-blue-500 text-white" : "bg-gray-200"}`}
                >
                    List View
                </button>
                <label className="flex items-center gap-2 ml-4">
                    <input
                        type="checkbox"
                        checked={hideEmptyHours}
                        onChange={(e) => setHideEmptyHours(e.target.checked)}
                    />
                    Hide empty hours
                </label>
            </div>

            {/* Selected note info */}
            <div className="mb-4 text-sm text-gray-600">
                Selected: {selectedNoteId || "none"}
            </div>

            {/* Editor */}
            <div className="border rounded-lg shadow-sm bg-white min-h-[500px] p-4">
                {view === "timeline" ? (
                    <TimelineBlockNoteList
                        notes={notes}
                        noteLabelsCache={noteLabelsCache}
                        noteAssigneesCache={noteAssigneesCache}
                        onSelectNote={setSelectedNoteId}
                        hideEmptyHours={hideEmptyHours}
                        startHour={8}
                        endHour={18}
                    />
                ) : (
                    <BlockNoteNoteList
                        notes={notes}
                        noteLabelsCache={noteLabelsCache}
                        noteAssigneesCache={noteAssigneesCache}
                        onSelectNote={setSelectedNoteId}
                    />
                )}
            </div>

            {/* Debug info */}
            <div className="mt-4 text-xs text-gray-500">
                <p>Notes count: {notes.length}</p>
                <p>Open console to see events (edit, toggle, delete, create)</p>
            </div>
        </div>
    );
};
