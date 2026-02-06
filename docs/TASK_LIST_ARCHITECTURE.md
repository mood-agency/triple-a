# Task List Architecture - Data Flow & Event System

> Complete reference for debugging the BlockNote task list (`BlockNoteNoteList.tsx`).
> Covers the full pipeline from Supabase to pixel, every sync effect, every user interaction event, and every known race condition.

---

## Table of Contents

1. [Component Hierarchy](#1-component-hierarchy)
2. [Data Pipeline: Supabase → Zustand → React → BlockNote](#2-data-pipeline)
3. [Sync Effects in BlockNoteNoteList](#3-sync-effects)
4. [Flags & Refs (Sync Protection)](#4-flags--refs)
5. [Event Bus: All Events](#5-event-bus-all-events)
6. [User Interaction Flows](#6-user-interaction-flows)
7. [Known Race Conditions & Mitigations](#7-known-race-conditions--mitigations)
8. [Debugging Guide](#8-debugging-guide)

---

## 1. Component Hierarchy

```
Home.tsx
  └── NotesWorkspace.tsx
        ├── NoteListToolbar.tsx
        ├── NoteListContent.tsx
        │     ├── ActiveFiltersBar.tsx
        │     ├── BlockNoteNoteList.tsx          ← Active tasks (BlockNote editor)
        │     │     └── NotepadBlock.tsx          ← Each task row (custom BlockNote block)
        │     │           └── useBlockCommands.ts ← Keyboard command pattern
        │     │                 ├── InsertBlockCommand      (Enter)
        │     │                 ├── NavigateToDescriptionCommand (Tab)
        │     │                 ├── ToggleCompleteCommand    (Ctrl+D)
        │     │                 ├── TogglePinCommand         (Ctrl+P)
        │     │                 ├── ArrowUpCommand / ArrowDownCommand
        │     │                 ├── BackspaceCommand
        │     │                 └── SaveCommand              (Ctrl+S)
        │     ├── MemoizedNoteRow.tsx             ← Completed/Deleted tasks
        │     └── TimelineBlockNoteList.tsx       ← Calendar view
        └── NoteEditorPanel.tsx                   ← Description panel (right side)
```

### Key Prop Flows

```
NotesWorkspace
  ├── notes: Note[]                  (from useNoteFilters → activeNotes)
  ├── selectedNote: Note | null      (from Home.tsx state)
  ├── onSelectNote(note)             (sets selectedNote in Home.tsx)
  ├── onEdit(id, content, category, description)
  ├── onCreateNoteAfter(afterId, category, deadline, labelIds, assigneeId, newNoteId)
  └── onToggleCompleted(id, completed)

NotesWorkspace → NoteListContent
  ├── handleSelectNoteById(id)       (finds note in notes[], calls onSelectNote)
  ├── handleNavigateToDescription()  (opens description panel)
  └── handleToggleCompletedWithNavigation(id, completed)

NoteListContent → BlockNoteNoteList
  ├── notes: Note[]                  (activeNotes, filtered & sorted)
  ├── onSelectNote(noteId: string)   → handleSelectNoteById
  ├── onNavigateToDescription()      → handleNavigateToDescription
  ├── onEdit(id, content, cat, desc) → Supabase update
  ├── onCreateNoteAfter(...)         → Supabase insert
  └── onToggleCompleted(id, bool)    → Supabase update
```

---

## 2. Data Pipeline

### 2.1 The Full Loop

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           SUPABASE (PostgreSQL)                        │
│                                                                        │
│  notes table: id, content, category, completed, updated_at, sort_order │
│               pinned, deadline, description, deleted_at, ...           │
└──────────┬──────────────────────────────────────┬──────────────────────┘
           │ Real-time (postgres_changes)          │ REST API (fetch/mutate)
           │ ~1-3s delay                           │ immediate
           ▼                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    useNotesSupabase.ts                                  │
│                                                                        │
│  Real-time handler:                                                    │
│    postgres_changes → debounce(300ms, or 2000ms if pending) →          │
│    fetchNotes() → supabase.from('notes').select('*') →                 │
│    store.mergeFetchedNotes(dbNotes)                                    │
│                                                                        │
│  CQRS events (source: 'command'):                                      │
│    note:created, note:updated, note:deleted → fetchNotes() immediately │
└──────────┬──────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    useNotesStore.ts (Zustand)                          │
│                                                                        │
│  State:                                                                │
│    notes: Note[]          ← source of truth for React                  │
│    pendingNoteIds: Set    ← optimistically-added notes not yet in DB   │
│                                                                        │
│  mergeFetchedNotes(dbNotes):                                           │
│    if no pending → notes = dbNotes (full replacement)                  │
│    if pending    → notes = [...dbNotes, ...stillPending]               │
│                                                                        │
│  addNote(note):           ← optimistic insert (Enter key)              │
│    notes = [...notes, note], pendingNoteIds.add(note.id)               │
│                                                                        │
│  removeNote(id):          ← optimistic delete                          │
│    notes = notes.filter(!id), pendingNoteIds.delete(id)                │
│    IMPORTANT: pendingNoteIds cleanup prevents mergeFetchedNotes         │
│    from re-adding the deleted note as "still pending"                  │
└──────────┬──────────────────────────────────────────────────────────────┘
           │ Zustand selector: useNotesStore(s => s.notes)
           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    useNoteFilters.ts                                    │
│                                                                        │
│  Input: notes[] from Zustand                                           │
│                                                                        │
│  Pipeline:                                                             │
│    notes → baseFilteredNotes (category, label, assignee, search,       │
│            task status, overdue, public, date range filters)           │
│          → activeNotes = baseFilteredNotes.filter(!completed)           │
│          → sortNotes(activeNotes, sortConfig)                          │
│          → completedNotes = baseFilteredNotes.filter(completed)        │
│                           → sortCompletedNotes(completedNotes)         │
│                                                                        │
│  Sort order (default, no explicit sort):                               │
│    1. Pinned first                                                     │
│    2. Original Supabase order (pinned DESC, sort_order ASC)            │
│                                                                        │
│  Sort order (with sortConfig):                                         │
│    sortConfig.category → by category order                             │
│    sortConfig.deadline → by deadline date                              │
│    sortConfig.assignee → by assignee name                              │
│    sortConfig.createdAt → by created_at date                           │
│                                                                        │
│  Output: activeNotes, completedNotes, filteredNotes                    │
└──────────┬──────────────────────────────────────────────────────────────┘
           │ props.notes = activeNotes
           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    BlockNoteNoteList.tsx                                │
│                                                                        │
│  Receives: notes[] (already filtered & sorted)                         │
│  Maintains: BlockNote editor with NotepadBlock custom blocks           │
│                                                                        │
│  Sync effects detect changes in notes[] and update editor blocks.      │
│  See Section 3 for details.                                            │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Timing: From Edit to Real-time Echo

```
t=0ms     User types in BlockNote
t=0ms     onChange fires → isSyncingRef checked → if false, content tracked
t=varies  User navigates away (Tab, Enter, Arrow, click)
          → navigation:saveCurrentItem → mediator.saveCurrentItem()
          → onEdit(id, content, category, description)
          → Supabase API call (REST)
t=~200ms  Supabase REST response (note saved, updated_at changed)
t=~1-3s   Supabase real-time delivers postgres_changes
          → useNotesSupabase: debounce → fetchNotes()
          → useNotesStore: mergeFetchedNotes → notes[] updated
          → useNoteFilters: activeNotes recomputed (may change order!)
          → BlockNoteNoteList: sync effect detects change
```

**Important timing detail:** `processNoteBlock` is `async` but its synchronous
part (before the first `await`) calls `onEdit()` → `updateNote()` →
`useNotesStore.getState().updateNote()`. This updates `notes[]` in the Zustand
store **immediately** (same microtask), before React batches any pending state
updates (like `setSelectedNoteId` or `setSearchParams`). Effects that depend on
`notes` can fire with stale values from other state — see RC-7.

### 2.3 Supabase Real-time Architecture

Two separate real-time channels operate simultaneously:

**Channel 1: `useSupabaseRealtime.ts`** — Event bus bridge
- Subscribes to `notes`, `note_labels`, `note_assignees` tables
- Emits domain events (source: `'realtime'`): `note:created`, `note:updated`, `note:completed`, etc.
- Used for cross-component coordination

**Channel 2: `useNotesSupabase.ts`** — Data refetch
- Subscribes to `notes` table only
- Debounces (300ms normal, 2000ms if pending notes) then calls `fetchNotes()`
- Replaces Zustand store with fresh data from DB
- This is what causes `notes[]` to change and trigger sync effects

---

## 3. Sync Effects in BlockNoteNoteList

### Effect 1: Fixed Note Sync (line ~762)

```
Trigger:  [editor, fixedNoteId, notes.length]
Purpose:  Update `fixedInSidebar` prop on all blocks
Action:   editor.updateBlock() for each block where state differs
Flash:    None
Flag:     Sets isSyncingRef during update
```

### Effect 2: Notes Array Sync — THE MAIN SYNC (line ~789)

```
Trigger:  [editor, notes, labelDataCache, assigneeDataCache, compactView, fixedNoteId]
Purpose:  Sync notes[] prop changes to BlockNote editor
```

**Decision tree:**

```
notes[] changed?
  │
  ├── previousNoteIdsRef !== currentNoteIds?
  │     │
  │     ├── YES → Compute:
  │     │    │    removedIds = IDs in previous but not in current
  │     │    │    removedIdsStillInDocument = removedIds still in editor
  │     │    │    notesWereAdded = IDs in current but not in previous or editor
  │     │    │    isInitialLoad = previousIds.size === 0
  │     │    │    editorHasFocus = ProseMirror contains activeElement
  │     │    │    orderChanged = same IDs, different order,
  │     │    │                   !isSavingInternallyRef, !editorHasFocus
  │     │    │
  │     │    ├── notesWereFiltered?    → FULL REPLACE + opacity flash
  │     │    ├── notesWereAdded?       → FULL REPLACE + opacity flash
  │     │    ├── isInitialLoad?        → FULL REPLACE (no flash)
  │     │    ├── orderChanged?         → FULL REPLACE + opacity flash
  │     │    └── none of above?        → NO-OP (content-only change)
  │     │
  │     │    FULL REPLACE:
  │     │      setIsSyncingFilter(true)          → .blocknote-syncing { opacity: 0 }
  │     │      setTimeout(0) →
  │     │        isSyncingRef = true
  │     │        newContent = notesToBlocks(notes, ...)
  │     │        editor.replaceBlocks(all, newContent)
  │     │        setTimeout(50) →
  │     │          isSyncingRef = false
  │     │          setIsSyncingFilter(false)      → opacity: 1
  │     │
  │     └── NO → skip
  │
  └── NO → skip
```

**Conditions explained:**

| Condition | When it fires | Example |
|-----------|--------------|---------|
| `notesWereFiltered` | Notes removed from list AND still in editor | User applies category filter |
| `notesWereAdded` | Notes appeared that aren't in editor | User removes a filter, broadening results |
| `isInitialLoad` | First render with notes | Page load |
| `orderChanged` | Same note IDs, different order, editor unfocused | User changes sort; or real-time `updated_at` change reorders notes |

### Effect 3: Label/Assignee Sync (line ~858)

```
Trigger:  [editor, notes, labelDataCache, assigneeDataCache]
Purpose:  Update label/assignee chip data on individual blocks
Action:   editor.updateBlock() per block where data differs
Flash:    None (updates individual blocks, not full replace)
Flag:     Sets isSyncingRef during updates
Guard:    Fingerprint comparison to skip no-op runs
```

---

## 4. Flags & Refs

### `isSyncingRef` (MutableRefObject\<boolean\>)

**Purpose:** Prevents the `onChange` handler from treating editor mutations as user edits.

| Set to `true` | When |
|---|---|
| Effect 1 | During fixedInSidebar block updates |
| Effect 2 | During full document replacement |
| Effect 3 | During label/assignee block updates |
| `note:completed` handler | During `editor.removeBlocks()` |
| `note:deleted` handler | During `editor.removeBlocks()` |
| `note:pinned` handler | During `editor.updateBlock()` |

| Set to `false` | When |
|---|---|
| All of the above | After `setTimeout(50)` |

| Checked at | Purpose |
|---|---|
| `onChange` handler | Skip tracking content changes during sync |

### `isSavingInternallyRef` (MutableRefObject\<boolean\>)

**Purpose:** Prevents `orderChanged` detection in Effect 2 from triggering a full replace after internal saves (which change `updated_at`).

| Set to `true` | When |
|---|---|
| `editor:createNoteAfter` handler | Before calling `onCreateNoteAfter()` |
| `useNoteBlockProcessing.processNoteBlock` | Before calling `onEdit()` (line 89-91) |

| Set to `false` | When |
|---|---|
| `editor:createNoteAfter` handler | After `setTimeout(500)` |
| `useNoteBlockProcessing.processNoteBlock` | After `setTimeout(500)` |

| Checked at | Purpose |
|---|---|
| Effect 2, `orderChanged` condition | Skip reorder if we just saved |

### `previousNoteIdsRef` (MutableRefObject\<string\>)

**Purpose:** Stores comma-joined note IDs from last Effect 2 run to detect changes.

```
Format: "id1,id2,id3"
Updated: At the start of Effect 2 (before condition checks)
```

### `previousBlockIdRef` (MutableRefObject\<string | null\>)

**Purpose:** Tracks which block has the cursor to detect selection changes.

```
Updated: In onSelectionChange handler
Used: To emit navigation:itemChanged only when selection actually changes
```

### `containerRef` (RefObject\<HTMLDivElement\>)

**Purpose:** Reference to the BlockNote wrapper div. Used for:
- FLIP animations (querying `.bn-block-outer` elements)
- Focus detection (`querySelector('.ProseMirror').contains(activeElement)`)
- Hiding blocks (`style.display = 'none'`) before removal

---

## 5. Event Bus: All Events

### Domain Events (source: `'ui'` | `'realtime'` | `'command'`)

| Event | Payload | Emitters | Listeners |
|-------|---------|----------|-----------|
| `note:completed` | `{ noteId, completed, completedAt }` | NotepadBlock checkbox, ToggleCompleteCommand, Supabase realtime | BlockNoteNoteList |
| `note:pinned` | `{ noteId, pinned }` | NotepadBlock pin button, TogglePinCommand, Supabase realtime | BlockNoteNoteList |
| `note:fixedInSidebar` | `{ noteId, fixedInSidebar }` | NotepadBlock sidebar button | BlockNoteNoteList |
| `note:deleted` | `{ noteId, reason }` | DeleteCommand, Supabase realtime | BlockNoteNoteList |
| `note:requestDelete` | `{ noteId }` | DeleteCommand (with content) | BlockNoteNoteList (shows confirm dialog) |
| `note:created` | `{ noteId, content, category, projectId }` | Supabase realtime | useNotesSupabase (refetch) |
| `note:updated` | `{ noteId, content, category, description }` | Supabase realtime | useNotesSupabase (refetch) |
| `note:deadlineUpdated` | `{ noteId, deadline, isAllDay }` | Deadline picker | — |
| `note:reordered` | `{ noteIds }` | Drag-and-drop | — |

### Editor Events

| Event | Payload | Emitters | Listeners |
|-------|---------|----------|-----------|
| `editor:navigateToDescription` | `{ noteId, cursorOffset?, content? }` | NavigateToDescriptionCommand (Tab) | BlockNoteNoteList, NotesWorkspace |
| `editor:createNoteAfter` | `{ afterNoteId, newNoteId?, category?, content? }` | InsertBlockCommand (Enter) | BlockNoteNoteList |
| `editor:focusLost` | `{ noteId }` | NotepadBlock (blur detection) | BlockNoteNoteList |
| `editor:saveSuccess` | `{ savedCount }` | processAllBlocks | NoteListContent (toast) |
| `editor:blockSelection` | `{ selectedBlockId, previousBlockId }` | BlockNoteNoteList (onSelectionChange) | NotepadBlock (isEditing state) |
| `editor:selectNote` | `{ noteId }` | — | — |

### Navigation Events (Mediator Pattern)

| Event | Payload | Emitters | Listeners |
|-------|---------|----------|-----------|
| `navigation:itemChanged` | `{ region, itemId }` | BlockNoteNoteList (selection change) | NotesWorkspace (mediator.setCurrentItem) |
| `navigation:saveCurrentItem` | `{ region }` | Various (before navigation) | NotesWorkspace (mediator.saveCurrentItem) |
| `navigation:pushHistory` | `{ region, noteId?, column? }` | BlockNoteNoteList (before Tab) | NotesWorkspace (mediator.pushFocusHistory) |

---

## 6. User Interaction Flows

### 6.1 Checkbox Click (Complete Task)

```
NotepadBlock.handleToggleCompleted()
  │
  ├── setIsCompleting(true)                    ← CSS: strikethrough + fade
  │
  └── setTimeout(600ms) ───────────────────┐
                                           │
  t=0ms   CSS: .is-completing applied      │
  t=0ms   Checkbox shows checked state     │
  t=0-400ms  Strikethrough grows across    │
  t=400-600ms  Row fades out               │
                                           │
  t=600ms ◄────────────────────────────────┘
  │
  eventBus.emit('note:completed', { completed: true })
  │
  └── BlockNoteNoteList handler:
        │
        ├── eventBus.emit('navigation:saveCurrentItem')
        ├── FLIP: capture positions of blocks below
        ├── Move cursor to adjacent block
        ├── blockOuter.style.display = 'none'     ← prevent flash
        ├── isSyncingRef = true
        ├── editor.removeBlocks([block])
        ├── setTimeout(50) → isSyncingRef = false
        ├── FLIP: animate remaining blocks sliding up (200ms)
        └── onToggleCompleted(noteId, true)        ← Supabase update
```

### 6.2 Ctrl+D (Complete Task via Keyboard)

```
ToggleCompleteCommand.execute()
  │
  ├── event.preventDefault()                    ← prevent browser bookmark
  ├── DOM: add .is-completing to notepad-line and notepad-content
  │
  └── setTimeout(600ms) ──→ eventBus.emit('note:completed')
                              │
                              └── (same flow as 6.1 from here)
```

### 6.3 Enter (Create New Task)

```
InsertBlockCommand.execute()
  │
  ├── editor.insertBlocks([newBlock], currentBlock, 'after')
  ├── editor.setTextCursorPosition(newBlock, 'start')
  │
  └── eventBus.emit('editor:createNoteAfter', { afterNoteId, newNoteId })
        │
        └── BlockNoteNoteList handler:
              │
              ├── eventBus.emit('navigation:saveCurrentItem')
              ├── processNoteBlock(afterNoteId)     ← parse hashtags
              ├── isSavingInternallyRef = true       ← PREVENT sync effect
              ├── onCreateNoteAfter(...)             ← Supabase insert
              └── setTimeout(500) → isSavingInternallyRef = false

  t=~200ms   Supabase REST responds (note created)
  t=~300ms   Zustand store: addNote() with pendingNoteIds
  t=~1-3s    Real-time: fetchNotes() → mergeFetchedNotes()
             → notes[] changes → Effect 2 runs
             → BUT: editorHasFocus = true → orderChanged = false
             → If note IDs match → NO-OP ✓
```

### 6.4 Tab (Navigate to Description)

```
NavigateToDescriptionCommand.execute()
  │
  ├── Get content from block (getBlockContent)
  ├── Get cursor offset (getCursorOffsetInBlock)
  │
  └── eventBus.emit('editor:navigateToDescription', { noteId, cursorOffset, content })
        │
        ├── BlockNoteNoteList handler:
        │     ├── processNoteBlock(noteId)          ← ASYNC but synchronous part runs first:
        │     │     onEdit() → updateNote() → useNotesStore.notes[] updates IMMEDIATELY
        │     │     (This notes[] change can trigger effects before URL updates — see RC-7)
        │     ├── navigation:pushHistory             ← save cursor position
        │     ├── onSelectNote(noteId)               ← handleSelectNote → setSelectedNoteId,
        │     │                                        syncStateToURL (setSearchParams batched)
        │     └── onNavigateToDescription()          ← navigatingToDescriptionRef=true (sync),
        │                                              showDescriptionPanel=true
        │
        └── NotesWorkspace handler:
              └── setTitleValue(noteId, cleanedContent)  ← immediate UI sync

  Timing:
    processNoteBlock's synchronous part updates notes[] BEFORE
    onSelectNote updates selectedNoteId, and BEFORE setSearchParams
    commits to the URL. This ordering is what caused RC-7.
```

### 6.5 Arrow Up/Down (Navigate Between Tasks)

```
ArrowUpCommand.execute() / ArrowDownCommand.execute()
  │
  └── Move cursor to prev/next block
        │
        └── BlockNote's onSelectionChange fires
              │
              ├── blockId !== previousBlockId?
              │     ├── YES:
              │     │     ├── eventBus.emit('navigation:itemChanged')
              │     │     │     └── NotesWorkspace: mediator.setCurrentItem()
              │     │     │           → saves previous item if data changed
              │     │     ├── processNoteBlock(previousBlockId)  ← parse hashtags
              │     │     ├── eventBus.emit('editor:blockSelection')
              │     │     │     └── NotepadBlock: updates isEditing state
              │     │     ├── onSelectNote(blockId)
              │     │     └── previousBlockIdRef = blockId
              │     └── NO: skip
```

### 6.6 Focus Lost (Click Outside / Blur)

```
NotepadBlock detects blur (isEditing → false)
  │
  └── eventBus.emit('editor:focusLost', { noteId })
        │
        └── BlockNoteNoteList handler:
              └── processNoteBlock(noteId)
                    ├── Parse hashtags (#label, @contact)
                    ├── Clean content (remove hashtag syntax)
                    ├── Update block in editor
                    ├── onEdit() if content changed
                    ├── onAddLabel() for each parsed label
                    └── onAddAssignee() for parsed assignee
```

### 6.7 Delete Task

```
User confirms delete (DeleteTaskDialog) or hotkey (Backspace on empty)
  │
  └── BlockNoteNoteList handler (note:deleted or handleConfirmDelete):
        │
        ├── editor.removeBlocks([block])            ← remove from BlockNote
        ├── onDelete(noteId, reason)                ← callback to parent
        │     │
        │     └── useNotesSupabase.deleteNote(id, reason):
        │           ├── store.removeNote(id)         ← remove from Zustand + pendingNoteIds
        │           ├── If empty content → hard delete (DELETE FROM notes)
        │           └── If has content → soft delete (SET deleted_at = NOW())
        │
        └── Real-time fires ~2s later:
              └── fetchNotes() → SELECT WHERE deleted_at IS NULL
                    → deleted note excluded from results
                    → mergeFetchedNotes() → pendingNoteIds clean → no ghost notes ✓
```

### 6.8 Filter/Sort Change

```
User clicks sort button in toolbar
  │
  └── sortConfig changes in useNoteFilters
        │
        └── activeNotes recomputed (same notes, different order)
              │
              └── BlockNoteNoteList receives new notes[] prop
                    │
                    └── Effect 2 runs:
                          ├── previousIds vs currentIds → same IDs
                          ├── removedIds = [] (none removed)
                          ├── editorHasFocus? (user clicked toolbar → probably false)
                          ├── orderChanged = true
                          ├── setIsSyncingFilter(true)    ← opacity: 0
                          ├── editor.replaceBlocks(all, newContent)
                          └── setIsSyncingFilter(false)   ← opacity: 1
```

---

## 7. Known Race Conditions & Mitigations

### RC-1: Real-time Echo Causes Order Change

```
Problem:  User edits note → Supabase updates updated_at → real-time echo
          arrives ~2-3s later → fetchNotes() → notes[] order changes →
          Effect 2 detects orderChanged → FULL REPLACE → caret lost

Mitigation: editorHasFocus check (line ~827)
  - If ProseMirror contains activeElement → orderChanged = false
  - Sort changes only apply when editor is unfocused

Gap: If user Tabs to description panel (editor loses focus) and real-time
     echo arrives, the task list will still do a full replace with flash.
```

### RC-2: New Note Not in notes[] When onSelectionChange Fires

```
Problem:  Enter creates block in editor → cursor moves → onSelectionChange
          calls handleSelectNoteById(newId) → notes.find(newId) returns
          undefined (note not in Zustand yet) → selectedNote stays as
          previous note

Mitigation: onSelectNote called in editor:navigateToDescription handler
  - By the time user presses Tab, the note IS in notes[] (2+ seconds passed)
  - handleSelectNoteById finds it and updates selectedNote

Gap: If user presses Tab immediately after Enter (< 300ms), the note may
     not be in notes[] yet. This is rare in practice.
```

### RC-3: isSavingInternallyRef Expires Before Real-time

```
Problem:  isSavingInternallyRef has 500ms timeout, but real-time delivers
          changes 1-3 seconds later → flag expired → orderChanged triggers

Mitigation: editorHasFocus check (RC-1 mitigation covers this too)
  - While user is typing, editor has focus → orderChanged suppressed
  - When user navigates away, the save has already completed and order
    is stable
```

### RC-4: Completion Animation Flash

```
Problem:  CSS fade-out animation ends at 600ms → ProseMirror re-renders
          during removeBlocks → block briefly visible at full opacity

Mitigation: blockOuter.style.display = 'none' (line ~1149)
  - Set display:none on the .bn-block-outer BEFORE calling removeBlocks
  - Block is invisible during ProseMirror's re-render
```

### RC-5: navigatingToDescriptionRef Race

```
Problem:  onSelectNote → useEffect detects noteIdChanged → checks
          navigatingToDescriptionRef → if false, closes description panel

Mitigation: Call order in Tab handler
  - onSelectNote() queues state update (batched)
  - onNavigateToDescription() sets ref = true SYNCHRONOUSLY
  - React processes batched render
  - useEffect runs → ref is already true → panel stays open

IMPORTANT: This flag is one-shot (consumed on first noteIdChanged).
  If a second noteIdChanged arrives (see RC-7), the flag is already
  false and the panel closes. RC-7's fix is the critical companion.
```

### RC-6: Deleted Notes Reappear as Ghost Notes (FIXED)

```
Problem:  User creates note (Enter) → note added to pendingNoteIds.
          User deletes note → deleteNote() soft-deletes in Supabase but
          didn't remove from Zustand store or pendingNoteIds.
          Real-time fires ~2s later → fetchNotes() → mergeFetchedNotes()
          sees note in pendingNoteIds but NOT in dbNotes → treats as
          "still pending" → re-adds to notes[] → ghost note reappears.

Fix (applied):
  1. removeNote() now also deletes from pendingNoteIds
  2. deleteNote() calls store.removeNote(id) BEFORE Supabase API call

  This ensures mergeFetchedNotes never sees the deleted note as pending.
```

### RC-7: URL Sync Effect Reverts selectedNoteId — Double-Tab Bug (FIXED)

```
Problem:  After Enter → type → Tab on a newly-created note, the description
          panel requires TWO Tab presses to open instead of one.

Root cause chain:
  1. User presses Tab inside a NotepadBlock
  2. BlockNoteNoteList handler fires:
     a. processNoteBlock(noteId) runs SYNCHRONOUSLY before first await:
        → onEdit() → updateNote() → useNotesStore.notes[] updates immediately
     b. onSelectNote(newNoteId) → Home.handleSelectNote()
        → setSelectedNoteId(newNoteId), syncStateToURL({ noteId: newNoteId })
     c. onNavigateToDescription() → navigatingToDescriptionRef = true
  3. React batches state updates. The URL sync effect in Home.tsx
     has [loading, notes, searchParams, selectedNoteId] in its deps.
  4. notes[] changed (step 2a) → effect fires
     BUT searchParams.get('note') still returns OLD note ID
     (React Router's setSearchParams hasn't committed yet)
  5. Effect sees selectedNoteId (new) !== URL noteId (old) →
     calls setSelectedNoteId(oldNoteId) → REVERTS selection
  6. useNoteSelection note-change effect fires TWICE:
     - 1st: newNote ID, navigatingToDescriptionRef=true → panel stays open ✓
     - 2nd: oldNote ID (reverted), navigatingToDescriptionRef=false → panel CLOSES ✗
  7. User must press Tab again → works because note is already selected

Fix (applied in Home.tsx):
  Two refs guard the URL sync effect:
    - lastUrlNoteParamRef: tracks last-processed URL note param
    - wasLoadingRef: tracks previous loading state

  Effect returns early when:
    !urlNoteChanged && !loadingJustFinished

  This means notes[] content updates no longer trigger a stale-URL sync.
  The effect only runs when the URL note param actually changes or
  when loading transitions from true→false (initial load / project switch).

Related: RC-5 (navigatingToDescriptionRef is one-shot, so it only
  survives one noteIdChanged. Without RC-7's fix, the second change
  from the URL revert consumes the unprotected flag.)
```

---

## 8. Debugging Guide

### "The list flashed/blinked"

**Look for:** `setIsSyncingFilter(true)` being called → `.blocknote-syncing` class → `opacity: 0`

**Check:**
1. Open console → look for `[BlockNote]` logs
2. Which condition triggered Effect 2?
   - `notesWereFiltered`: A note was removed from `notes[]` but still in editor
   - `notesWereAdded`: A note appeared in `notes[]` but not in editor
   - `orderChanged`: Same notes, different order, editor unfocused
3. Was it a real-time echo? Check if it happened ~2-3s after an edit

### "Caret jumped to end"

**Look for:** Full document replacement via `editor.replaceBlocks()`

**Check:**
1. Was `isSavingInternallyRef.current` false? (500ms expired?)
2. Was `editorHasFocus` false? (user tabbed away?)
3. Did `orderChanged` fire? (same IDs, different order)

### "Content disappeared"

**Look for:** `editor.replaceBlocks()` replacing user's unsaved content

**Check:**
1. Was the note's content saved before the replace? Check `navigation:saveCurrentItem`
2. Was `isSyncingRef` properly set during the replace?
3. Did the `onChange` handler track the content change?

### "Description panel doesn't open on first Tab" (Double-Tab)

**Look for:** `selectedNoteId` reverting to a previous note after Tab

**Check:**
1. Add `console.log` in Home.tsx URL sync effect — does it fire twice?
2. Is `searchParams.get('note')` stale (old note ID) when `notes` triggers the effect?
3. Is `lastUrlNoteParamRef` correctly tracking the last URL param? (see RC-7)
4. Is `navigatingToDescriptionRef` consumed on the first noteIdChanged? (see RC-5)
5. Repro pattern: Enter → type content → Tab immediately (the typed content save triggers notes[] change)

### "Description panel shows wrong note"

**Look for:** `selectedNote` not matching the focused BlockNote block

**Check:**
1. Was `onSelectNote` called with the correct ID?
2. Did `handleSelectNoteById` find the note in `notes[]`?
3. For new notes: is the note in `notes[]` yet? Check `pendingNoteIds`

### "Deleted notes reappear"

**Look for:** `pendingNoteIds` not being cleaned when notes are removed.

**Check:**
1. Is `store.removeNote(id)` called during deletion? (should be in `deleteNote()`)
2. After removal, is the ID gone from `pendingNoteIds`?
3. In `mergeFetchedNotes`, log `stillPending` — are deleted notes in there?
4. Check real-time debounce: `pendingNoteIds.size > 0` → 2000ms delay

### "Task completion has no animation"

**Check:**
1. Is the category `todo` or `followup`? (other categories can't complete)
2. Is `isCompleting` state set in NotepadBlock?
3. Are CSS classes `.is-completing` applied to `.notepad-line` and `.notepad-content`?
4. Check the `note:completed` handler — is source `'command'`? (skipped to avoid loops)

### Useful Console Logging Points

```typescript
// In Effect 2 (line ~789), add:
console.log('[Sync Effect 2]', {
  notesWereFiltered, notesWereAdded, isInitialLoad, orderChanged,
  editorHasFocus, isSavingInternally: isSavingInternallyRef.current,
  previousIds: previousNoteIdsRef.current?.split(',').length,
  currentIds: notes.length,
});

// In onSelectionChange (line ~720), add:
console.log('[Selection]', { blockId, previousBlockId, changed: blockId !== previousBlockId });

// In note:completed handler (line ~1112), add:
console.log('[Complete]', { noteId: event.payload.noteId, source: event.source });
```

---

## File Reference

| File | Purpose |
|------|---------|
| `events/types.ts` | All event type definitions |
| `events/index.ts` | Event bus implementation (pub/sub) |
| `stores/useNotesStore.ts` | Zustand store for notes |
| `hooks/supabase/useNotesSupabase.ts` | Supabase fetch + real-time → Zustand |
| `hooks/supabase/useSupabaseRealtime.ts` | Real-time → event bus bridge |
| `components/notes/hooks/useNoteFilters.ts` | Filter + sort pipeline |
| `components/notes/hooks/useNoteSelection.ts` | Selection state + description panel |
| `components/notes/hooks/useNoteOperations.ts` | CRUD operation wrappers |
| `components/notes/hooks/useNoteBlockProcessing.ts` | Hashtag parsing + block processing |
| `components/notes/NotesWorkspace.tsx` | Orchestrator (mediator, callbacks) |
| `components/notes/NoteListContent.tsx` | Layout (active/completed/deleted sections) |
| `components/notes/BlockNoteNoteList.tsx` | **Main file** — BlockNote editor + sync |
| `components/notes/navigation/useNavigationMediator.ts` | Save coordination |
| `components/blocknote/NotepadBlock.tsx` | Custom block component |
| `components/blocknote/NotepadBlock.css` | Block styling + animations |
| `components/blocknote/commands/*.ts` | Keyboard command handlers |
| `utils/noteUtils.ts` | Sort functions |
| `utils/noteBlockAdapter.ts` | Note ↔ BlockNote block conversion |
