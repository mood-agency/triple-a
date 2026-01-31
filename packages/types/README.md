# @triple-a/types

Shared TypeScript types for the Triple-A ecosystem.

## Installation

```bash
npm install @triple-a/types
# or
pnpm add @triple-a/types
# or
yarn add @triple-a/types
```

## Usage

```typescript
import type { Note, Label, Project, Contact } from '@triple-a/types';

const note: Note = {
  id: '123',
  content: 'My note',
  // ... other properties
};
```

## What's Included

- **Core Types**: `Note`, `Label`, `Project`, `Contact`, `Task`
- **API Types**: Request/response types for API endpoints
- **Utility Types**: Common shared interfaces

## License

MIT
