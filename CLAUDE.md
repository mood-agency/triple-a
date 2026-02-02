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
