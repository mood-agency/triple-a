#!/usr/bin/env node
/**
 * Triple-A API CLI
 *
 * Full-featured command-line interface for the Triple-A note management API
 *
 * Usage:
 *   node triple-a-cli.js <resource> <action> [options]
 *
 * Resources:
 *   notes, labels, projects, contacts, history
 *
 * Examples:
 *   node triple-a-cli.js notes list --date 2026-01-27
 *   node triple-a-cli.js notes create --content "Task" --category todo --date 2026-01-27
 *   node triple-a-cli.js notes search --query "API"
 *   node triple-a-cli.js labels list
 */

import {
  createClient,
  formatNotesList,
  formatNote,
  formatSearchResults,
  formatLabelsList,
  formatProjectsList,
  formatContactsList,
  formatSuccess,
} from '@triple-a/client';

// Create client instance
const client = createClient();

// Parse command-line arguments
function parseArgs(args) {
  const parsed = { flags: {}, positional: [] };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;

      if (value !== true) {
        i++; // Skip next arg since we consumed it
      }

      parsed.flags[key] = value;
    } else {
      parsed.positional.push(arg);
    }
  }

  return parsed;
}

// Help text
function showHelp() {
  console.log(`
Triple-A API CLI

Usage:
  node triple-a-cli.js <resource> <action> [options]

Resources & Actions:

  NOTES:
    list [--date YYYY-MM-DD] [--category todo|followup|notes|meeting] [--completed true|false] [--project-id ID]
    get <id>
    create --content "..." --category <cat> --date YYYY-MM-DD [--description "..."] [--project-id ID] [--labels ID,ID]
    update <id> --completed true [--content "..."] [--category <cat>]
    delete <id>
    search --query "text" [--category cat] [--completed true|false]
    history <id>

  LABELS:
    list
    get <id>
    create --name "..." [--color "#hex"]
    update <id> --name "..." [--color "#hex"]
    delete <id>
    notes <id>

  PROJECTS:
    list
    get <id>
    create --name "..." [--description "..."]
    update <id> --name "..." [--description "..."]
    delete <id>
    notes <id>

  CONTACTS:
    list
    get <id>
    create --name "..." [--email "..."]
    update <id> --name "..." [--email "..."]
    delete <id>
    notes <id>

  HISTORY:
    list [--note-id ID] [--action-type created|edit|postponed|completed|uncompleted]

Examples:
  node triple-a-cli.js notes list --date 2026-01-27 --completed false
  node triple-a-cli.js notes create --content "Review PR" --category todo --date 2026-01-27
  node triple-a-cli.js notes search --query "API" --category todo
  node triple-a-cli.js labels create --name "urgent" --color "#ff0000"
  node triple-a-cli.js projects create --name "Triple-A Development"
  node triple-a-cli.js contacts create --name "John Doe" --email "john@example.com"

Environment Variables:
  TRIPLE_A_API_KEY       Your API key (required)
  TRIPLE_A_BASE_URL      API base URL (default: http://localhost:3000)
  DEBUG                  Enable debug logging
`);
}

// NOTES commands
async function handleNotes(action, args) {
  switch (action) {
    case 'list': {
      const params = new URLSearchParams();
      if (args.flags.date) params.append('date', args.flags.date);
      if (args.flags.category) params.append('category', args.flags.category);
      if (args.flags.completed !== undefined) params.append('completed', args.flags.completed);
      if (args.flags['project-id']) params.append('project_id', args.flags['project-id']);
      if (args.flags.limit) params.append('limit', args.flags.limit);
      if (args.flags.offset) params.append('offset', args.flags.offset);

      const response = await client.get(`/api/v1/notes?${params.toString()}`);
      console.log(formatNotesList(response.data));
      break;
    }

    case 'get': {
      const id = args.positional[0];
      if (!id) throw new Error('Note ID is required. Usage: notes get <id>');

      const response = await client.get(`/api/v1/notes/${id}`);
      console.log(formatNote(response.data));
      break;
    }

    case 'create': {
      if (!args.flags.content || !args.flags.category || !args.flags.date) {
        throw new Error('Required: --content --category --date');
      }

      const body = {
        content: args.flags.content,
        category: args.flags.category,
        date: args.flags.date,
      };

      if (args.flags.description) body.description = args.flags.description;
      if (args.flags['project-id']) body.project_id = args.flags['project-id'];
      if (args.flags.labels) body.labels = args.flags.labels.split(',');
      if (args.flags.deadline) body.deadline = args.flags.deadline;
 
      const response = await client.post('/api/v1/notes', body);
      console.log(formatSuccess('Note created!'));
      console.log(formatNote(response.data));
      break;
    }

    case 'update': {
      const id = args.positional[0];
      if (!id) throw new Error('Note ID is required. Usage: notes update <id> [options]');

      const body = {};
      if (args.flags.content) body.content = args.flags.content;
      if (args.flags.description) body.description = args.flags.description;
      if (args.flags.category) body.category = args.flags.category;
      if (args.flags.completed !== undefined)
        body.completed = args.flags.completed === 'true';
      if (args.flags.pinned !== undefined) body.pinned = args.flags.pinned === 'true';
      if (args.flags.date) body.date = args.flags.date;
      if (args.flags['project-id']) body.project_id = args.flags['project-id'];
      if (args.flags.labels) body.labels = args.flags.labels.split(',');

      const response = await client.patch(`/api/v1/notes/${id}`, body);
      console.log(formatSuccess('Note updated!'));
      console.log(formatNote(response.data));
      break;
    }

    case 'delete': {
      const id = args.positional[0];
      if (!id) throw new Error('Note ID is required. Usage: notes delete <id>');

      await client.delete(`/api/v1/notes/${id}`);
      console.log(formatSuccess(`Note ${id} deleted`));
      break;
    }

    case 'search': {
      if (!args.flags.query) {
        throw new Error('Required: --query');
      }

      const body = {
        query: args.flags.query,
        filters: {},
      };

      if (args.flags.category) body.filters.category = args.flags.category;
      if (args.flags.completed !== undefined)
        body.filters.completed = args.flags.completed === 'true';
      if (args.flags['date-from']) body.filters.date_from = args.flags['date-from'];
      if (args.flags['date-to']) body.filters.date_to = args.flags['date-to'];

      const response = await client.post('/api/v1/notes/search', body);
      console.log(formatSearchResults(response.data, args.flags.query));
      break;
    }

    case 'history': {
      const id = args.positional[0];
      if (!id) throw new Error('Note ID is required. Usage: notes history <id>');

      const response = await client.get(`/api/v1/notes/${id}/history`);
      console.log('\n📜 Note History:\n');
      console.log(JSON.stringify(response.data, null, 2));
      break;
    }

    default:
      throw new Error(`Unknown action: ${action}. Run --help for usage.`);
  }
}

// LABELS commands
async function handleLabels(action, args) {
  switch (action) {
    case 'list': {
      const response = await client.get('/api/v1/labels');
      console.log(formatLabelsList(response.data));
      break;
    }

    case 'get': {
      const id = args.positional[0];
      if (!id) throw new Error('Label ID is required. Usage: labels get <id>');

      const response = await client.get(`/api/v1/labels/${id}`);
      console.log('\n🏷️  Label:\n');
      console.log(JSON.stringify(response.data, null, 2));
      break;
    }

    case 'create': {
      if (!args.flags.name) {
        throw new Error('Required: --name');
      }

      const body = { name: args.flags.name };
      if (args.flags.color) body.color = args.flags.color;

      const response = await client.post('/api/v1/labels', body);
      console.log(formatSuccess('Label created!'));
      console.log(JSON.stringify(response.data, null, 2));
      break;
    }

    case 'update': {
      const id = args.positional[0];
      if (!id) throw new Error('Label ID is required. Usage: labels update <id> [options]');

      const body = {};
      if (args.flags.name) body.name = args.flags.name;
      if (args.flags.color) body.color = args.flags.color;

      const response = await client.put(`/api/v1/labels/${id}`, body);
      console.log(formatSuccess('Label updated!'));
      console.log(JSON.stringify(response.data, null, 2));
      break;
    }

    case 'delete': {
      const id = args.positional[0];
      if (!id) throw new Error('Label ID is required. Usage: labels delete <id>');

      await client.delete(`/api/v1/labels/${id}`);
      console.log(formatSuccess(`Label ${id} deleted`));
      break;
    }

    case 'notes': {
      const id = args.positional[0];
      if (!id) throw new Error('Label ID is required. Usage: labels notes <id>');

      const response = await client.get(`/api/v1/labels/${id}/notes`);
      console.log(formatNotesList(response.data));
      break;
    }

    default:
      throw new Error(`Unknown action: ${action}. Run --help for usage.`);
  }
}

// PROJECTS commands
async function handleProjects(action, args) {
  switch (action) {
    case 'list': {
      const response = await client.get('/api/v1/projects');
      console.log(formatProjectsList(response.data));
      break;
    }

    case 'get': {
      const id = args.positional[0];
      if (!id) throw new Error('Project ID is required. Usage: projects get <id>');

      const response = await client.get(`/api/v1/projects/${id}`);
      console.log('\n📂 Project:\n');
      console.log(JSON.stringify(response.data, null, 2));
      break;
    }

    case 'create': {
      if (!args.flags.name) {
        throw new Error('Required: --name');
      }

      const body = { name: args.flags.name };
      if (args.flags.description) body.description = args.flags.description;

      const response = await client.post('/api/v1/projects', body);
      console.log(formatSuccess('Project created!'));
      console.log(JSON.stringify(response.data, null, 2));
      break;
    }

    case 'update': {
      const id = args.positional[0];
      if (!id) throw new Error('Project ID is required. Usage: projects update <id> [options]');

      const body = {};
      if (args.flags.name) body.name = args.flags.name;
      if (args.flags.description) body.description = args.flags.description;

      const response = await client.put(`/api/v1/projects/${id}`, body);
      console.log(formatSuccess('Project updated!'));
      console.log(JSON.stringify(response.data, null, 2));
      break;
    }

    case 'delete': {
      const id = args.positional[0];
      if (!id) throw new Error('Project ID is required. Usage: projects delete <id>');

      await client.delete(`/api/v1/projects/${id}`);
      console.log(formatSuccess(`Project ${id} deleted`));
      break;
    }

    case 'notes': {
      const id = args.positional[0];
      if (!id) throw new Error('Project ID is required. Usage: projects notes <id>');

      const response = await client.get(`/api/v1/projects/${id}/notes`);
      console.log(formatNotesList(response.data));
      break;
    }

    default:
      throw new Error(`Unknown action: ${action}. Run --help for usage.`);
  }
}

// CONTACTS commands
async function handleContacts(action, args) {
  switch (action) {
    case 'list': {
      const response = await client.get('/api/v1/contacts');
      console.log(formatContactsList(response.data));
      break;
    }

    case 'get': {
      const id = args.positional[0];
      if (!id) throw new Error('Contact ID is required. Usage: contacts get <id>');

      const response = await client.get(`/api/v1/contacts/${id}`);
      console.log('\n👤 Contact:\n');
      console.log(JSON.stringify(response.data, null, 2));
      break;
    }

    case 'create': {
      if (!args.flags.name) {
        throw new Error('Required: --name');
      }

      const body = { name: args.flags.name };
      if (args.flags.email) body.email = args.flags.email;

      const response = await client.post('/api/v1/contacts', body);
      console.log(formatSuccess('Contact created!'));
      console.log(JSON.stringify(response.data, null, 2));
      break;
    }

    case 'update': {
      const id = args.positional[0];
      if (!id) throw new Error('Contact ID is required. Usage: contacts update <id> [options]');

      const body = {};
      if (args.flags.name) body.name = args.flags.name;
      if (args.flags.email) body.email = args.flags.email;

      const response = await client.put(`/api/v1/contacts/${id}`, body);
      console.log(formatSuccess('Contact updated!'));
      console.log(JSON.stringify(response.data, null, 2));
      break;
    }

    case 'delete': {
      const id = args.positional[0];
      if (!id) throw new Error('Contact ID is required. Usage: contacts delete <id>');

      await client.delete(`/api/v1/contacts/${id}`);
      console.log(formatSuccess(`Contact ${id} deleted`));
      break;
    }

    case 'notes': {
      const id = args.positional[0];
      if (!id) throw new Error('Contact ID is required. Usage: contacts notes <id>');

      const response = await client.get(`/api/v1/contacts/${id}/notes`);
      console.log(formatNotesList(response.data));
      break;
    }

    default:
      throw new Error(`Unknown action: ${action}. Run --help for usage.`);
  }
}

// HISTORY commands
async function handleHistory(action, args) {
  if (action !== 'list') {
    throw new Error(`Unknown action: ${action}. Only "list" is supported for history.`);
  }

  const params = new URLSearchParams();
  if (args.flags['note-id']) params.append('note_id', args.flags['note-id']);
  if (args.flags['action-type']) params.append('action_type', args.flags['action-type']);
  if (args.flags.limit) params.append('limit', args.flags.limit);
  if (args.flags.offset) params.append('offset', args.flags.offset);

  const response = await client.get(`/api/v1/history?${params.toString()}`);
  console.log('\n📜 History:\n');
  console.log(JSON.stringify(response.data, null, 2));
}

// Main function
async function main() {
  const rawArgs = process.argv.slice(2);

  // Show help
  if (rawArgs.length === 0 || rawArgs.includes('--help') || rawArgs.includes('-h')) {
    showHelp();
    return;
  }

  const resource = rawArgs[0];
  const action = rawArgs[1];
  const args = parseArgs(rawArgs.slice(2));

  try {
    switch (resource) {
      case 'notes':
        await handleNotes(action, args);
        break;
      case 'labels':
        await handleLabels(action, args);
        break;
      case 'projects':
        await handleProjects(action, args);
        break;
      case 'contacts':
        await handleContacts(action, args);
        break;
      case 'history':
        await handleHistory(action, args);
        break;
      default:
        console.error(`Unknown resource: ${resource}`);
        console.error('Run --help for usage.');
        process.exit(1);
    }
  } catch (error) {
    client.formatError(error);
    process.exit(1);
  }
}

main();
