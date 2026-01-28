#!/usr/bin/env node
/**
 * Example: List today's pending tasks
 *
 * Usage:
 *   node list-today.js
 *   node list-today.js --all          # Include completed tasks
 *   node list-today.js --category followup
 */

import { client } from '../../lib/client.js';
import { formatNotesList } from '../../lib/formatters.js';

async function main() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const args = process.argv.slice(2);

    // Parse arguments
    const showAll = args.includes('--all');
    const categoryIndex = args.indexOf('--category');
    const category = categoryIndex !== -1 ? args[categoryIndex + 1] : 'todo';

    // Build query string
    const params = new URLSearchParams({
      date: today,
      category,
    });

    if (!showAll) {
      params.append('completed', 'false');
    }

    console.log(`Fetching ${category} tasks for ${today}...`);

    const response = await client.get(`/api/v1/notes?${params.toString()}`);

    console.log(formatNotesList(response.data));
  } catch (error) {
    client.formatError(error);
    process.exit(1);
  }
}

main();
