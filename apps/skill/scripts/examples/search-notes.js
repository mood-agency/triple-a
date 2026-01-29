#!/usr/bin/env node
/**
 * Example: Search notes with full-text query
 *
 * Usage:
 *   node search-notes.js "API"
 *   node search-notes.js "meeting" --category meeting
 *   node search-notes.js "urgent" --completed false
 */

import { createClient, formatSearchResults, formatError } from '@triple-a/client';

const client = createClient();

async function main() {
  try {
    const args = process.argv.slice(2);

    if (args.length === 0 || args[0].startsWith('--')) {
      console.error('Usage: node search-notes.js <query> [--category <cat>] [--completed true|false]');
      console.error('Example: node search-notes.js "API" --category todo --completed false');
      process.exit(1);
    }

    const query = args[0];
    const filters = {};

    // Parse optional filters
    const categoryIndex = args.indexOf('--category');
    if (categoryIndex !== -1 && args[categoryIndex + 1]) {
      filters.category = args[categoryIndex + 1];
    }

    const completedIndex = args.indexOf('--completed');
    if (completedIndex !== -1 && args[completedIndex + 1]) {
      filters.completed = args[completedIndex + 1] === 'true';
    }

    console.log(`Searching for: "${query}"`);
    if (Object.keys(filters).length > 0) {
      console.log('Filters:', JSON.stringify(filters, null, 2));
    }

    const response = await client.post('/api/v1/notes/search', {
      query,
      filters,
    });

    console.log(formatSearchResults(response.data, query));
  } catch (error) {
    console.error(formatError(error));
    process.exit(1);
  }
}

main();
