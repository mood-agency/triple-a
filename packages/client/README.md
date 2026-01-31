# @triple-a/client

TypeScript API client for Triple-A with automatic authentication, retry logic, and rate limit handling.

## Installation

```bash
npm install @triple-a/client
# or
pnpm add @triple-a/client
# or
yarn add @triple-a/client
```

## Usage

```typescript
import { TripleAClient } from '@triple-a/client';

const client = new TripleAClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.triple-a.example.com' // optional
});

// Fetch notes
const notes = await client.getNotes();

// Create a note
const newNote = await client.createNote({
  content: 'My new note',
  labels: ['work']
});
```

## Features

- Automatic authentication with API keys
- Retry logic with exponential backoff
- Rate limit handling
- Full TypeScript support
- Formatters for CLI output

## License

MIT
