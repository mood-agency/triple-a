#!/usr/bin/env node
/**
 * Example: Create a todo task for today
 *
 * Usage:
 *   node create-task.js
 *   node create-task.js "Custom task content"
 */

import { createClient, formatNote, formatSuccess, formatError } from '@triple-a/client';

const client = createClient();

async function main() {
  try {
    const content = process.argv[2] || 'Review pull request';
    const today = new Date().toISOString().split('T')[0];

    console.log(`Creating task: "${content}"`);

    const response = await client.post('/api/v1/notes', {
      content,
      category: 'todo',
      date: today,
      description: 'Created via triple-a-api skill script',
    });

    console.log(formatSuccess('Task created successfully!'));
    console.log(formatNote(response.data));
  } catch (error) {
    console.error(formatError(error));
    process.exit(1);
  }
}

main();
