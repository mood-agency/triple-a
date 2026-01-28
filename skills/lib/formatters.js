/**
 * Output Formatters for Triple-A API Responses
 *
 * Functions to format API responses into human-readable output
 */

/**
 * Format a list of notes as a table
 */
export function formatNotesList(notes) {
  if (!notes || notes.length === 0) {
    return '📭 No notes found';
  }

  const lines = [];
  lines.push(`\n📝 Found ${notes.length} note(s):\n`);

  notes.forEach((note, index) => {
    const completed = note.completed ? '✅' : '⬜';
    const pinned = note.pinned ? '📌 ' : '';
    const content = note.content.length > 60 ? note.content.substring(0, 57) + '...' : note.content;

    lines.push(`${index + 1}. ${completed} ${pinned}${content}`);
    lines.push(`   ID: ${note.id}`);
    lines.push(`   Date: ${note.date} | Category: ${note.category}`);

    if (note.description) {
      const desc =
        note.description.length > 60
          ? note.description.substring(0, 57) + '...'
          : note.description;
      lines.push(`   Description: ${desc}`);
    }

    if (note.labels && note.labels.length > 0) {
      lines.push(`   Labels: ${note.labels.length} label(s)`);
    }

    if (note.project_id) {
      lines.push(`   Project: ${note.project_id}`);
    }

    if (note.assignee_id) {
      lines.push(`   Assigned to: ${note.assignee_id}`);
    }

    if (note.deadline) {
      lines.push(`   Deadline: ${note.deadline}`);
    }

    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Format a single note with full details
 */
export function formatNote(note) {
  if (!note) {
    return '❌ Note not found';
  }

  const lines = [];
  lines.push('\n📝 Note Details:\n');

  const completed = note.completed ? '✅ Completed' : '⬜ Not completed';
  const pinned = note.pinned ? '📌 Pinned' : '';

  lines.push(`ID: ${note.id}`);
  lines.push(`Content: ${note.content}`);
  if (note.description) {
    lines.push(`Description: ${note.description}`);
  }
  lines.push(`Date: ${note.date}`);
  lines.push(`Category: ${note.category}`);
  lines.push(`Status: ${completed} ${pinned}`);

  if (note.completed_at) {
    lines.push(`Completed at: ${note.completed_at}`);
  }

  if (note.deadline) {
    lines.push(`Deadline: ${note.deadline}`);
  }

  if (note.assignee_id) {
    lines.push(`Assigned to: ${note.assignee_id}`);
  }

  if (note.project_id) {
    lines.push(`Project: ${note.project_id}`);
  }

  if (note.labels && note.labels.length > 0) {
    lines.push(`Labels: ${note.labels.join(', ')}`);
  }

  lines.push(`\nCreated: ${note.created_at}`);
  lines.push(`Updated: ${note.updated_at}`);

  if (note.deleted_at) {
    lines.push(`❌ Deleted: ${note.deleted_at}`);
    if (note.deleted_reason) {
      lines.push(`   Reason: ${note.deleted_reason}`);
    }
  }

  return lines.join('\n') + '\n';
}

/**
 * Format search results
 */
export function formatSearchResults(results, query) {
  if (!results || results.length === 0) {
    return `🔍 No results found for "${query}"`;
  }

  const lines = [];
  lines.push(`\n🔍 Search results for "${query}" (${results.length} found):\n`);

  results.forEach((note, index) => {
    const completed = note.completed ? '✅' : '⬜';
    const content = note.content.length > 70 ? note.content.substring(0, 67) + '...' : note.content;

    lines.push(`${index + 1}. ${completed} ${content}`);
    lines.push(`   ${note.date} | ${note.category} | ID: ${note.id}`);

    if (note.description) {
      const desc =
        note.description.length > 70
          ? note.description.substring(0, 67) + '...'
          : note.description;
      lines.push(`   ${desc}`);
    }

    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Format a list of labels
 */
export function formatLabelsList(labels) {
  if (!labels || labels.length === 0) {
    return '🏷️  No labels found';
  }

  const lines = [];
  lines.push(`\n🏷️  Found ${labels.length} label(s):\n`);

  labels.forEach((label, index) => {
    lines.push(`${index + 1}. ${label.name}`);
    lines.push(`   ID: ${label.id}`);
    if (label.color) {
      lines.push(`   Color: ${label.color}`);
    }
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Format a list of projects
 */
export function formatProjectsList(projects) {
  if (!projects || projects.length === 0) {
    return '📂 No projects found';
  }

  const lines = [];
  lines.push(`\n📂 Found ${projects.length} project(s):\n`);

  projects.forEach((project, index) => {
    lines.push(`${index + 1}. ${project.name}`);
    lines.push(`   ID: ${project.id}`);
    if (project.description) {
      const desc =
        project.description.length > 70
          ? project.description.substring(0, 67) + '...'
          : project.description;
      lines.push(`   ${desc}`);
    }
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Format a list of contacts
 */
export function formatContactsList(contacts) {
  if (!contacts || contacts.length === 0) {
    return '👤 No contacts found';
  }

  const lines = [];
  lines.push(`\n👤 Found ${contacts.length} contact(s):\n`);

  contacts.forEach((contact, index) => {
    lines.push(`${index + 1}. ${contact.name}`);
    lines.push(`   ID: ${contact.id}`);
    if (contact.email) {
      lines.push(`   Email: ${contact.email}`);
    }
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Format success message
 */
export function formatSuccess(message) {
  return `\n✅ ${message}\n`;
}

/**
 * Format error message
 */
export function formatError(error) {
  const lines = [];
  lines.push('\n❌ Error:', error.message);

  if (error.code) {
    lines.push(`Code: ${error.code}`);
  }

  if (error.details) {
    lines.push('Details:', JSON.stringify(error.details, null, 2));
  }

  return lines.join('\n') + '\n';
}
