# @triple-a/agent

AI agent for Triple-A task management using Agno and Claude. Process natural language queries and execute tasks via Triple-A API.

## Features

- 🤖 Natural language understanding powered by Claude 3.5 Sonnet
- 🛠️ 16 tools for comprehensive task management, web search, and transcription
- 📦 Standalone package - use from any interface (CLI, Telegram, web)
- 🔒 Secure - API key per request, no storage
- 💪 TypeScript-first with full type safety
- 🔍 Web search via DuckDuckGo for real-time information
- 🎙️ Audio/video transcription via AssemblyAI

## Installation

```bash
# From the monorepo root
pnpm add @triple-a/agent

# Or in your package
pnpm add @triple-a/agent @triple-a/client @triple-a/types
```

## Quick Start

```typescript
import { TripleAAgent } from '@triple-a/agent';

// Create agent instance
const agent = new TripleAAgent({
  apiKey: 'sk_live_...', // Your Triple-A API key
  baseURL: 'http://localhost:3000', // Optional, defaults to localhost
  assemblyaiApiKey: 'your_assemblyai_key' // Optional, for transcription features
});

// Send natural language queries
const response = await agent.chat('Create a task to buy milk for tomorrow');
console.log(response);
// => "✅ Task created! Buy milk for 2026-02-01"
```

## Environment Setup

The agent requires an Anthropic API key:

```bash
export ANTHROPIC_API_KEY=your_anthropic_key
```

Optional: For transcription features, set AssemblyAI API key:

```bash
export ASSEMBLYAI_API_KEY=your_assemblyai_key
```

Triple-A API credentials are passed per request in the agent constructor.

## Available Tools

The agent has access to 16 tools:

### Notes (6 tools)
- `create_note` - Create tasks, notes, meetings, follow-ups
- `list_notes` - Filter by date, category, project, completion
- `search_notes` - Full-text search across notes
- `update_note` - Update any note property
- `delete_note` - Soft delete a note
- `get_note` - Get details of a specific note

### Labels (2 tools)
- `create_label` - Create tags for organization
- `list_labels` - List all labels

### Projects (2 tools)
- `create_project` - Create project groupings
- `list_projects` - List all projects

### Contacts (2 tools)
- `create_contact` - Create assignable contacts
- `list_contacts` - List all contacts

### Batch (1 tool)
- `batch_operations` - Execute multiple operations atomically

### Web Search (1 tool)
- `search_web` - Search DuckDuckGo for real-time information

### Transcription (2 tools)
- `transcribe_audio` - Transcribe audio/video files with optional speaker labels, sentiment analysis, and entity detection
- `get_transcript` - Retrieve a previously created transcript

## Example Queries

The agent understands natural language:

```typescript
// Creating tasks
await agent.chat('Create a task to call John tomorrow at 2pm');
await agent.chat('Add a meeting with the team on Friday');
await agent.chat('Remind me to review the PR');

// Listing and searching
await agent.chat('What tasks do I have today?');
await agent.chat('Show me all pending todos');
await agent.chat('Search for notes about the API');

// Updating
await agent.chat('Mark the first task as complete');
await agent.chat('Move my grocery task to next week');

// Projects and organization
await agent.chat('Create a project called Work');
await agent.chat('Show tasks in the Personal project');

// Web search
await agent.chat('Search for the latest news about AI');
await agent.chat('Find information about TypeScript best practices');

// Transcription (requires AssemblyAI API key)
await agent.chat('Transcribe this audio file: https://example.com/audio.mp3');
await agent.chat('Transcribe with speaker labels: https://example.com/meeting.mp4');
```

## Conversation History

Maintain context across multiple turns:

```typescript
const history = [
  { role: 'user', content: 'Create a task to buy groceries' },
  { role: 'assistant', content: '✅ Task created! ID: abc123' }
];

// Agent remembers the context
const response = await agent.chat('Mark it as complete', { history });
// => "✅ Marked 'Buy groceries' as complete"
```

## Error Handling

```typescript
try {
  const response = await agent.chat(query);
  console.log(response);
} catch (error) {
  if (error.code === 'INVALID_API_KEY') {
    console.error('Invalid API key');
  } else if (error.code === 'RATE_LIMIT_EXCEEDED') {
    console.error('Rate limit exceeded, please wait');
  } else {
    console.error('Error:', error.message);
  }
}
```

## Testing

Run the included test script:

```bash
cd packages/agent

# Set environment variables
export ANTHROPIC_API_KEY=your_key
export TRIPLE_A_API_KEY=your_triple_a_key

# Run tests
pnpm tsx test.ts
```

## Architecture

```
Natural Language Query
    ↓
Agno Agent Framework → Claude (with 13 tools)
    ↓
@triple-a/client (existing package)
    ↓
Triple-A API (apps/api)
```

## Development

```bash
# Build
pnpm build

# Watch mode
pnpm dev

# Type check
pnpm type-check
```

## License

MIT
