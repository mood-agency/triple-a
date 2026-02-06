# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo Structure

This is a **pnpm workspace monorepo** with Turborepo for build orchestration.

```
triple-a/
├── packages/
│   ├── types/          # @triple-a/types - Shared TypeScript types
│   └── client/         # @triple-a/client - API client SDK
├── apps/
│   ├── web/            # @triple-a/web - React frontend
│   ├── api/            # @triple-a/api - Hono backend
│   └── skill/          # @triple-a/skill - Molt.bot skill
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

## Development Commands

```bash
# Install dependencies (run from root)
pnpm install

# Development
pnpm dev              # Start all services
pnpm dev:web          # Start frontend only (port 11000)
pnpm dev:api          # Start backend only (port 3000)

# Build
pnpm build            # Build all packages
pnpm --filter @triple-a/web build
pnpm --filter @triple-a/api build
pnpm --filter @triple-a/types build
pnpm --filter @triple-a/client build

# Lint & Type Check
pnpm lint             # Lint all packages
pnpm type-check       # Type check all packages

# Mobile/Desktop (from apps/web)
pnpm --filter @triple-a/web cap:build      # Capacitor build
pnpm --filter @triple-a/web tauri:build    # Tauri build
```

## Package Overview

### @triple-a/types (`packages/types/`)
Shared TypeScript types for Notes, Labels, Projects, Contacts, API responses, etc.

### @triple-a/client (`packages/client/`)
TypeScript API client with:
- Automatic authentication
- Retry logic with exponential backoff
- Rate limit handling
- Formatters for CLI output

### @triple-a/web (`apps/web/`)
React 19 frontend with:
- Vite 7 + React Router v7
- TinyBase for offline-first state
- Supabase for auth/sync
- Tailwind CSS v4 + shadcn/ui
- i18next (Spanish default)
- Capacitor (Android) + Tauri (Desktop)

### @triple-a/api (`apps/api/`)
Hono.js backend with:
- 44 REST endpoints
- API key authentication (bcrypt)
- Rate limiting
- Supabase admin client

### @triple-a/skill (`apps/skill/`)
Molt.bot/Clawdbot skill for CLI access to the API.

## Path Aliases

In `apps/web`:
- `@/*` resolves to `./src/*`

## Adding Components

```bash
cd apps/web
pnpm dlx shadcn@latest add <component> -o
```

## Adding Translations

Add keys to both:
- `apps/web/src/i18n/locales/en.json`
- `apps/web/src/i18n/locales/es.json`

## shadcn/ui Guidelines

**IMPORTANT: Always use official shadcn/ui components and styles.**

- **Never manually modify** shadcn/ui component styles
- **Style**: `new-york` (configured in `apps/web/components.json`)
- **Base color**: `neutral`
- For custom styling, add className overrides at the usage site
- Official docs: https://ui.shadcn.com/docs/components

## Motion Animations

This project uses the `motion` library (formerly Framer Motion) for animations. When implementing animations that can be interrupted or restarted, follow this pattern:

```tsx
import { animate } from 'motion';

// Track pending animation frames for cleanup
const animationFrameRef = useRef<number | null>(null);

// Track running animations for cleanup
const runningAnimationsRef = useRef<Array<{ stop: () => void }>>([]);

useEffect(() => {
  // 1. Cancel any pending animations when state changes
  if (animationFrameRef.current) {
    cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
  }
  runningAnimationsRef.current.forEach(anim => anim.stop());
  runningAnimationsRef.current = [];

  // 2. Use double requestAnimationFrame to ensure DOM is ready
  const frameId1 = requestAnimationFrame(() => {
    const frameId2 = requestAnimationFrame(() => {
      animationFrameRef.current = null;

      const elements = containerRef.current?.querySelectorAll('.my-element');
      const allElements: HTMLElement[] = [];
      elements?.forEach(el => allElements.push(el as HTMLElement));

      // 3. Clear inline styles from previous animations
      allElements.forEach(el => {
        el.style.opacity = '';
        el.style.transform = '';
      });

      // 4. Run animations and store references
      const animations: Array<{ stop: () => void }> = [];
      allElements.forEach((el, index) => {
        const anim = animate(
          el,
          { opacity: [0, 1], transform: ['translateX(-8px)', 'translateX(0px)'] },
          { duration: 0.2, delay: index * 0.015, easing: 'ease-out' }
        );
        animations.push(anim);
      });
      runningAnimationsRef.current = animations;
    });
    animationFrameRef.current = frameId2;
  });
  animationFrameRef.current = frameId1;
}, [trigger]);
```

Key points:
- **Always cancel** pending `requestAnimationFrame` and running animations on state change
- **Use double RAF** to ensure DOM is fully painted before animating
- **Clear inline styles** before re-animating to avoid conflicts
- **Store animation references** to enable cancellation

## Event-Driven Architecture with Mediator Pattern

The notes components use an **Event-Driven Architecture** combined with a **Mediator Pattern** for decoupled communication between UI regions.

> **Note**: This is NOT CQRS. CQRS separates read/write models. We use events for coordination and callbacks for mutations - a simpler event-driven approach.

### Core Concepts

1. **Event Bus** (`@/events`): Centralized pub/sub for domain events - coordinates *when* things happen
2. **Navigation Mediator** (`./navigation`): Coordinates keyboard navigation and save operations across regions - decides *if* to save
3. **Callbacks**: Direct function calls for data mutations - execute *what* to do
4. **Regions**: Independent UI areas (`'search'`, `'taskList'`, `'editor'`, `'sidebar'`, `'toolbar'`)

### When to Use Events vs Callbacks

| Use Case | Pattern | Example |
|----------|---------|---------|
| Cross-component coordination | Event Bus | `navigation:saveCurrentItem`, `editor:navigateToDescription` |
| Data mutations (persistence) | Callbacks | `onEdit()`, `onToggleCompleted()` |
| UI state sync (immediate) | Event Bus | Updating `titleValue` when Tab is pressed |
| Parent-child direct communication | Callbacks | `onSelectNote()`, `onNavigateToDescription()` |

### Event Bus Pattern

```tsx
import { eventBus, useEventSubscription } from '@/events';

// Emitting events
eventBus.emit('navigation:saveCurrentItem', { region: 'taskList' });
eventBus.emit('editor:navigateToDescription', { noteId, cursorOffset, content });

// Subscribing to events (in React components)
useEventSubscription('editor:navigateToDescription', (event) => {
  // Multiple components can listen to the same event
  if (event.payload.content !== undefined) {
    selection.setTitleValue(event.payload.content);
  }
});
```

### Navigation Mediator Pattern

The mediator centralizes save coordination. Components provide data via `RegionHandler`, mediator decides when/how to save.

```tsx
// 1. Create mediator with onSaveItem callback (in parent component)
const navigationMediator = useNavigationMediator({
  onSaveItem: (region, itemId, data) => {
    // Centralized save logic - compare and persist
    if (region === 'taskList') {
      const note = notes.find(n => n.id === itemId);
      if (note && data.content !== note.content) {
        onEdit(itemId, data.content, data.category, data.description);
      }
    }
  },
});

// 2. Register region handlers (in child components)
const regionHandler = useMemo<RegionHandler>(() => ({
  region: 'taskList',
  focusFirst: (column?, context?) => { /* focus logic */ },
  focusLast: () => { /* focus logic */ },
  canReceiveFocus: () => true,
  getItemData: (itemId) => ({
    content: currentContent,
    category: note.category,
    description: note.description,
  }),
  getCurrentItemId: () => focusedNoteId,
}), [dependencies]);

useRegisterNavigationRegion(regionHandler);

// 3. Trigger saves via events (components don't call mediator directly)
eventBus.emit('navigation:saveCurrentItem', { region: 'taskList' });
```

### Key Events

| Event | Payload | Purpose |
|-------|---------|---------|
| `navigation:itemChanged` | `{ region, itemId }` | Notify mediator of focus change |
| `navigation:saveCurrentItem` | `{ region }` | Request save for current item in region |
| `navigation:pushHistory` | `{ region, noteId, column }` | Push focus state for later restoration |
| `editor:navigateToDescription` | `{ noteId, cursorOffset, content }` | Tab pressed, navigate to description |
| `editor:saveSuccess` | `{ savedCount }` | Trigger UI feedback (toast) |
| `note:completed` | `{ noteId, completed }` | Task completion toggled |
| `note:pinned` | `{ noteId, pinned }` | Task pin toggled |

### Architecture Principles

1. **Events for coordination, callbacks for execution**: Events decide *when* to act, callbacks decide *what* to do
2. **Multiple listeners allowed**: Same event can trigger different behaviors in different components
3. **Mediator owns save logic**: Components provide data, mediator compares and decides to save
4. **Immediate UI sync via events**: Pass data in events for instant feedback before async operations complete
5. **Regions are independent**: Each region registers its own handler, operates independently

### File Locations

- Event types: `apps/web/src/events/types.ts`
- Event bus: `apps/web/src/events/index.ts`
- Navigation types: `apps/web/src/components/notes/navigation/types.ts`
- Navigation mediator: `apps/web/src/components/notes/navigation/useNavigationMediator.ts`
- Region registration: `apps/web/src/components/notes/navigation/useRegisterNavigationRegion.ts`

## Notes Workspace Component Hierarchy

```
Home.tsx                              # URL state, selectedNoteId, filters, data mutation callbacks
└── NotesWorkspace.tsx                # Keyboard mediator, sidebar/description panel state, useNoteSelection
    ├── NoteListContent.tsx           # Conditional render: list vs calendar, passes stabilized callbacks
    │   └── BlockNoteNoteList.tsx     # BlockNote editor instance, block ↔ note sync, event subscriptions
    │       └── NotepadBlock.tsx × N  # Custom block: checkbox, title, deadline, labels, assignees
    ├── NoteEditorPanel (editor)      # Description editor for selectedNote
    └── NoteEditorPanel (sidebar)     # Description editor for fixedNote (pinned)
```

### Key Prop Flow

- **Home → NotesWorkspace**: `notes[]`, `selectedNote` (derived via `useMemo`), mutation callbacks (`onEdit`, `onDelete`, etc.), filter state
- **NotesWorkspace → NoteListContent**: filtered note arrays, stabilized handlers (`handleSelectNoteById`, `handleToggleCompletedWithNavigation`)
- **NoteListContent → BlockNoteNoteList**: `notes[]`, `onSelectNote`, `onNavigateToDescription`, mutation callbacks
- **BlockNoteNoteList → NotepadBlock**: block props (via `notesToBlocks` adapter): `isChecked`, `category`, `date`, `labels[]`, `assignees[]`, `compact`, `pinned`

## Three-Layer State Management

State flows through three layers: **URL → React State → Zustand Stores**.

### Layer 1: URL (`searchParams`)
Source of truth for routing/shareable state: `?note=id&category=tasks&view=list&labels=...`

### Layer 2: React State (`Home.tsx`)
- `selectedNoteId` — initialized from URL, synced bidirectionally
- `viewMode`, `categoryFilter`, `labelFilter`, `assigneeFilter`, `sortConfig` — all synced to URL
- `selectedNote` — derived from `notes.find(n => n.id === selectedNoteId)` via `useMemo` (prevents re-renders when note content changes but ID stays the same)
- `stateRef` — ref mirror of all state values to prevent stale closures in `syncStateToURL`

### Layer 3: Zustand Stores

**`useNotesStore`** — Note collection + persistence metadata:
- `notes: Note[]`, `loading`, `pendingNoteIds: Set<string>`
- Optimistic updates: store updates synchronously, DB writes async
- `mergeFetchedNotes()` preserves locally-pending notes during refetch

**`useNoteFieldsStore`** — Live editor state for notes being edited:
- `notes: Record<noteId, { titleValue, descriptionValue, deadlineValue, labelsValue, assigneesValue }>`
- `selectedNoteId` and `fixedNoteId` — two notes can coexist (main + sidebar)
- `selectNote()`/`selectFixedNote()` manage lifecycle: initialize entry on select, delete on deselect (unless shared)

**`useNotesSupabase`** — Wraps `useNotesStore` with Supabase persistence:
- Pattern: synchronous store update + async DB write (fire-and-forget)
- Real-time subscription with debounced refetch (300ms, 2000ms if pending notes)
- Version creation throttled to 30s for description changes

### URL ↔ State Sync Pitfall

The URL sync effect in `Home.tsx` must guard against re-running when only `notes` content changes (not the URL). Without guards, a content save (e.g. `processNoteBlock` → `updateNote`) updates the `notes` array, triggers the effect, which reads the **stale URL** (React Router's `setSearchParams` hasn't committed yet) and reverts `selectedNoteId`. The fix uses refs to track the last-processed URL note param and only syncs when the URL actually changes or loading completes.

## BlockNote Keyboard Event Architecture

**`useBlockCommands`** registers a `keydown` listener on `document` with `{ capture: true }`, which fires **before** all other listeners including BlockNote internals and `useHotkeys`. When a registered command matches, it calls `e.stopImmediatePropagation()`, preventing the event from reaching any other handler.

**Consequence: `useHotkeys` handlers NEVER fire for keyboard events inside BlockNote blocks.** All block-level keyboard handling goes through the command pattern. Global hotkeys (e.g. Ctrl+Z undo in filters) set `enableOnContentEditable: false` to avoid conflicts. Some hotkeys explicitly set `enableOnContentEditable: true` to work in both contexts (e.g. Alt+T for deadline).

### Registered Block Commands

| Key | Command | File |
|-----|---------|------|
| `Enter` | InsertBlockCommand | Creates new block, emits `editor:createNoteAfter` |
| `Tab` | NavigateToDescriptionCommand | Emits `editor:navigateToDescription` |
| `Backspace` | DeleteBlockCommand | Deletes empty block, Ctrl+Backspace for non-empty |
| `Ctrl+A` | SelectAllCommand | Selects text in current block only (not all blocks) |
| `ArrowUp/Down` | NavigateBlockCommand | Moves between blocks, preserves cursor column |
| `ArrowLeft/Right` | PreventNavigateOutCommand | Prevents cursor from leaving editable area |
| `Ctrl+D` | ToggleCompleteCommand | Toggles task completion |
| `Ctrl+P` | TogglePinCommand | Toggles pin state |
| `Ctrl+S` | ToggleSidebarCommand | Toggles fixed-in-sidebar |

### Tab Navigation Flow (Complete Chain)

```
1. User presses Tab inside a NotepadBlock
2. useBlockCommands (capture phase) → NavigateToDescriptionCommand.execute()
3. eventBus.emit('editor:navigateToDescription', { noteId, cursorOffset, content })
4. BlockNoteNoteList handler:
   a. processNoteBlock(noteId) — fire-and-forget async, but synchronous part
      calls onEdit() → updateNote() → useNotesStore updates notes[] immediately
   b. onSelectNote(noteId) → handleSelectNoteById → handleSelectNote
      → setSelectedNoteId, syncStateToURL
   c. onNavigateToDescription() → handleNavigateToDescription
      → navigatingToDescriptionRef=true, showDescriptionPanel=true
5. NotesWorkspace handler (same event):
   → setTitleValue(cleaned content) for immediate UI sync
6. useNoteSelection note-change effect:
   → navigatingToDescriptionRef is true → panel stays open (flag consumed)
```

### `navigatingToDescriptionRef` One-Shot Flag

`useNoteSelection` uses this ref to prevent the note-change `useEffect` from closing the description panel when Tab navigation explicitly opens it. The flag is set `true` synchronously in `handleNavigateToDescription`, consumed (set `false`) on the first `noteIdChanged` effect, protecting the panel from being closed. If a second note ID change arrives (e.g. from a race condition), the flag is already consumed and the panel would close — this is why the URL sync guard in Home.tsx is critical.

### `processNoteBlock` Timing

`processNoteBlock` is `async` but its **synchronous part** (before the first `await`) calls `onEdit()` → `updateNote()` → `useNotesStore.getState().updateNote()`, updating the `notes` array **before** React processes the `selectedNoteId` change from `onSelectNote`. This ordering means store subscribers (including the URL sync effect) see the `notes` change before the URL has been updated.

## Key File Reference

| File | Responsibility |
|------|---------------|
| `apps/web/src/pages/Home.tsx` | URL state, note selection, filter orchestration |
| `apps/web/src/components/notes/NotesWorkspace.tsx` | Keyboard mediator, panel state, event wiring |
| `apps/web/src/components/notes/NoteListContent.tsx` | List/calendar view switching, drag & drop |
| `apps/web/src/components/notes/BlockNoteNoteList.tsx` | BlockNote editor, block ↔ note sync, event handlers |
| `apps/web/src/components/blocknote/NotepadBlock.tsx` | Custom block rendering (checkbox, title, metadata) |
| `apps/web/src/components/blocknote/hooks/useBlockCommands.ts` | Capture-phase keyboard interception |
| `apps/web/src/components/blocknote/commands/` | Command implementations (InsertBlock, NavigateToDescription, etc.) |
| `apps/web/src/components/notes/hooks/useNoteSelection.ts` | Description panel state, auto-save, focus management |
| `apps/web/src/stores/useNotesStore.ts` | Note collection (optimistic updates) |
| `apps/web/src/stores/useNoteFieldsStore.ts` | Live editor fields per note |
| `apps/web/src/hooks/supabase/useNotesSupabase.ts` | Store + Supabase persistence wrapper |
| `apps/web/src/events/types.ts` | All event type definitions |
| `apps/web/src/components/notes/navigation/useNavigationMediator.ts` | Save coordination across regions |
