#!/usr/bin/env node
/**
 * Example: Complete a task by ID
 *
 * Usage:
 *   node complete-task.js <note-id>
 */

import { client } from '../../lib/client.js';
import { formatSuccess, formatNote } from '../../lib/formatters.js';

async function main() {
  try {
    const noteId = process.argv[2];

    if (!noteId) {
      console.error('Usage: node complete-task.js <note-id>');
      console.error('Example: node complete-task.js 550e8400-e29b-41d4-a716-446655440000');
      process.exit(1);
    }

    console.log(`Completing task ${noteId}...`);

    // Update the note to mark as completed
    const response = await client.patch(`/api/v1/notes/${noteId}`, {
      completed: true,
    });

    console.log(formatSuccess('Task completed!'));
    console.log(formatNote(response.data));
  } catch (error) {
    client.formatError(error);
    process.exit(1);
  }
}

main();
