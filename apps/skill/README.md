# Triple-A API Skill for Molt.bot

Hybrid skill combining Markdown instructions with executable JavaScript scripts for reliable API operations.

## Features

- 🚀 **Full CLI** with all API operations
- 📝 **Example scripts** for common workflows
- 🔄 **Automatic retries** for rate limits and errors
- 🎯 **Formatted output** for readable results
- 🔐 **Automatic authentication** via environment variables
- ⚡ **Zero dependencies** - uses Node.js native `fetch`

## Installation

1. **Generate API Key** from Triple-A web UI:
   - Go to Settings → API Keys
   - Create new key with scopes: `read`, `write`, `delete`
   - Copy the key (shown only once): `sk_live_...`

2. **Configure molt.bot**:
   ```yaml
   skills:
     entries:
       triple-a-api:
         apiKey: "sk_live_..."  # Your API key
   ```

3. **Verify installation**:
   ```bash
   cd skills
   export TRIPLE_A_API_KEY="sk_live_..."
   node scripts/examples/list-today.js
   ```

## Usage

### With molt.bot/clawdbot

Invoke the skill and use natural language:

```
/triple-a-api

"List my tasks for today"
"Create a todo for tomorrow"
"Search for notes containing 'API'"
"Create a label called 'urgent'"
```

### Direct Script Execution

#### Main CLI

```bash
# List notes
node scripts/triple-a-cli.js notes list --date 2026-01-27 --completed false

# Create note
node scripts/triple-a-cli.js notes create \
  --content "Review pull request" \
  --category todo \
  --date 2026-01-27

# Search
node scripts/triple-a-cli.js notes search --query "API"

# Help
node scripts/triple-a-cli.js --help
```

#### Example Scripts

```bash
# Create a task
node scripts/examples/create-task.js "My custom task"

# List today's tasks
node scripts/examples/list-today.js

# Search notes
node scripts/examples/search-notes.js "API"

# Complete a task
node scripts/examples/complete-task.js <note-id>

# Assign a label
node scripts/examples/assign-label.js <note-id> urgent "#ff0000"
```

## Architecture

```
skills/
├── SKILL.md                    # Molt.bot skill definition (Markdown instructions)
├── package.json                # Skill metadata
├── lib/
│   ├── config.js              # Configuration & env validation
│   ├── client.js              # HTTP client with retry logic
│   └── formatters.js          # Output formatting
└── scripts/
    ├── triple-a-cli.js        # Full-featured CLI
    └── examples/
        ├── create-task.js     # Example: create task
        ├── list-today.js      # Example: list today
        ├── search-notes.js    # Example: search
        ├── complete-task.js   # Example: complete
        └── assign-label.js    # Example: assign label
```

## Environment Variables

- `TRIPLE_A_API_KEY` (required) - Your API key from Settings → API Keys
- `TRIPLE_A_BASE_URL` (optional) - API base URL (default: http://localhost:3000)
- `DEBUG=1` (optional) - Enable debug logging

## Error Handling

The scripts handle all API error codes with helpful hints:

- **INVALID_API_KEY** - Check your API key format
- **API_KEY_REVOKED** - Generate a new key
- **API_KEY_EXPIRED** - Extend expiration or create new key
- **INSUFFICIENT_SCOPE** - Create key with required scopes
- **RATE_LIMIT_EXCEEDED** - Automatic retry after 60s
- **VALIDATION_ERROR** - Check required fields
- **NOT_FOUND** - Verify resource ID

## Development

### Testing Scripts Locally

```bash
cd skills
export TRIPLE_A_API_KEY="sk_live_..."

# Test example scripts
node scripts/examples/create-task.js
node scripts/examples/list-today.js

# Test CLI
node scripts/triple-a-cli.js notes list --date $(date +%Y-%m-%d)
```

### Adding New Scripts

1. Create script in `scripts/examples/`
2. Import client: `import { client } from '../../lib/client.js'`
3. Use formatters: `import { formatNotesList } from '../../lib/formatters.js'`
4. Handle errors: Wrap in try/catch with `client.formatError(error)`

Example template:

```javascript
#!/usr/bin/env node
import { client } from '../../lib/client.js';
import { formatSuccess } from '../../lib/formatters.js';

async function main() {
  try {
    const response = await client.get('/api/v1/...');
    console.log(formatSuccess('Operation successful!'));
    // ... format output
  } catch (error) {
    client.formatError(error);
    process.exit(1);
  }
}

main();
```

## Benefits of Executable Scripts

- ✅ **Determinism** - Tested code vs regenerating HTTP calls
- ✅ **Token efficiency** - Scripts don't load into LLM context
- ✅ **Reliability** - Automatic retries and error handling
- ✅ **Performance** - No code generation latency
- ✅ **Maintainability** - Single client benefits all scripts

## API Documentation

See [SKILL.md](./SKILL.md) for complete API reference including:

- All 31 REST API endpoints
- Request/response schemas
- Query parameters and filters
- Error codes and handling
- Best practices

## Support

For issues or questions:
- API documentation: See SKILL.md
- Server code: ../server.js
- Type definitions: ../src/types/note.ts

## Packing the Skill

To package the skill for distribution via clawdbot/molt.bot:

```bash
cd skills
npx @anthropic-ai/clawdbot pack
```

This produces a `.clawdbot` file you can publish or share. The pack command bundles:

- `SKILL.md` (skill definition with frontmatter metadata)
- `lib/` (client, config, formatters)
- `scripts/` (CLI and example scripts)
- `package.json`

Make sure `SKILL.md` frontmatter is up to date before packing — it defines the skill name, description, required environment variables, and binary dependencies.

## License

MIT
