#!/usr/bin/env node
/**
 * Example: Create a label and assign it to a note
 *
 * Usage:
 *   node assign-label.js <note-id> <label-name> [color]
 *   node assign-label.js 550e8400-e29b-41d4-a716-446655440000 urgent "#ff0000"
 */

import { client } from '../../lib/client.js';
import { formatSuccess, formatNote } from '../../lib/formatters.js';

async function main() {
  try {
    const noteId = process.argv[2];
    const labelName = process.argv[3];
    const labelColor = process.argv[4] || '#3b82f6'; // Default: blue

    if (!noteId || !labelName) {
      console.error('Usage: node assign-label.js <note-id> <label-name> [color]');
      console.error(
        'Example: node assign-label.js 550e8400-e29b-41d4-a716-446655440000 urgent "#ff0000"'
      );
      process.exit(1);
    }

    // Step 1: Create the label
    console.log(`Creating label "${labelName}" with color ${labelColor}...`);
    const labelResponse = await client.post('/api/v1/labels', {
      name: labelName,
      color: labelColor,
    });

    const labelId = labelResponse.data.id;
    console.log(formatSuccess(`Label created with ID: ${labelId}`));

    // Step 2: Get current note to preserve existing labels
    console.log(`Fetching note ${noteId}...`);
    const noteResponse = await client.get(`/api/v1/notes/${noteId}`);
    const currentLabels = noteResponse.data.labels || [];

    // Step 3: Add new label to note
    console.log(`Assigning label to note...`);
    const updatedNote = await client.patch(`/api/v1/notes/${noteId}`, {
      labels: [...currentLabels, labelId],
    });

    console.log(formatSuccess(`Label "${labelName}" assigned to note!`));
    console.log(formatNote(updatedNote.data));
  } catch (error) {
    client.formatError(error);
    process.exit(1);
  }
}

main();
