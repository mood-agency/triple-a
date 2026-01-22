import type { Note, NoteHistory, Label, NoteLabel, ExportData } from '@/types/note';

/**
 * Validate that imported data matches expected structure
 * Performs comprehensive validation of all data types
 */
export function validateImportData(data: unknown): data is ExportData {
  console.log('[Import] Starting validation...');

  if (!data || typeof data !== 'object') {
    console.error('[Import] Data is not an object:', data);
    return false;
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.version !== 'string') {
    console.error('[Import] Invalid version:', obj.version);
    return false;
  }
  if (typeof obj.exportedAt !== 'string') {
    console.error('[Import] Invalid exportedAt:', obj.exportedAt);
    return false;
  }
  if (!Array.isArray(obj.notes)) {
    console.error('[Import] Notes is not an array:', obj.notes);
    return false;
  }
  if (!Array.isArray(obj.noteHistory)) {
    console.error('[Import] NoteHistory is not an array:', obj.noteHistory);
    return false;
  }

  console.log(`[Import] Validating ${obj.notes.length} notes...`);
  for (let i = 0; i < obj.notes.length; i++) {
    const note = obj.notes[i];
    if (!validateNote(note)) {
      console.error(`[Import] Invalid note at index ${i}:`, note);
      return false;
    }
  }

  console.log(`[Import] Validating ${obj.noteHistory.length} history entries...`);
  for (let i = 0; i < obj.noteHistory.length; i++) {
    const history = obj.noteHistory[i];
    if (!validateNoteHistory(history)) {
      console.error(`[Import] Invalid history at index ${i}:`, history);
      return false;
    }
  }

  // Validate labels if present (optional)
  if (obj.labels !== undefined) {
    if (!Array.isArray(obj.labels)) {
      console.error('[Import] Labels is not an array:', obj.labels);
      return false;
    }
    console.log(`[Import] Validating ${obj.labels.length} labels...`);
    for (let i = 0; i < obj.labels.length; i++) {
      const label = obj.labels[i];
      if (!validateLabel(label)) {
        console.error(`[Import] Invalid label at index ${i}:`, label);
        return false;
      }
    }
  }

  // Validate noteLabels if present (optional)
  if (obj.noteLabels !== undefined) {
    if (!Array.isArray(obj.noteLabels)) {
      console.error('[Import] NoteLabels is not an array:', obj.noteLabels);
      return false;
    }
    console.log(`[Import] Validating ${obj.noteLabels.length} note-label relations...`);
    for (let i = 0; i < obj.noteLabels.length; i++) {
      const noteLabel = obj.noteLabels[i];
      if (!validateNoteLabel(noteLabel)) {
        console.error(`[Import] Invalid noteLabel at index ${i}:`, noteLabel);
        return false;
      }
    }
  }

  console.log('[Import] Validation passed!');
  return true;
}

/**
 * Validate a single note object
 */
function validateNote(note: unknown): note is Note {
  if (!note || typeof note !== 'object') {
    console.error('[validateNote] Not an object');
    return false;
  }

  const n = note as Record<string, unknown>;

  if (typeof n.id !== 'string') {
    console.error('[validateNote] Invalid id:', n.id);
    return false;
  }
  if (typeof n.date !== 'string') {
    console.error('[validateNote] Invalid date:', n.date);
    return false;
  }
  if (typeof n.content !== 'string') {
    console.error('[validateNote] Invalid content:', n.content);
    return false;
  }
  if (n.description !== null && typeof n.description !== 'string') {
    console.error('[validateNote] Invalid description:', n.description);
    return false;
  }
  if (n.category !== 'todo' && n.category !== 'followup' && n.category !== 'notes') {
    console.error('[validateNote] Invalid category:', n.category);
    return false;
  }
  if (typeof n.completed !== 'boolean') {
    console.error('[validateNote] Invalid completed:', n.completed);
    return false;
  }
  if (n.pinned !== undefined && typeof n.pinned !== 'boolean') {
    console.error('[validateNote] Invalid pinned:', n.pinned);
    return false;
  }
  if (n.completed_at !== undefined && n.completed_at !== null && typeof n.completed_at !== 'string') {
    console.error('[validateNote] Invalid completed_at:', n.completed_at);
    return false;
  }
  if (n.deadline !== undefined && n.deadline !== null && typeof n.deadline !== 'string') {
    console.error('[validateNote] Invalid deadline:', n.deadline);
    return false;
  }
  if (n.sort_order !== undefined && typeof n.sort_order !== 'number') {
    console.error('[validateNote] Invalid sort_order:', n.sort_order);
    return false;
  }
  if (typeof n.created_at !== 'string') {
    console.error('[validateNote] Invalid created_at:', n.created_at);
    return false;
  }
  if (typeof n.updated_at !== 'string') {
    console.error('[validateNote] Invalid updated_at:', n.updated_at);
    return false;
  }

  return true;
}

/**
 * Validate a single note history entry
 * Supports migration from old format (pre-description field)
 */
function validateNoteHistory(history: unknown): history is NoteHistory {
  if (!history || typeof history !== 'object') {
    console.error('[validateNoteHistory] Not an object');
    return false;
  }

  const h = history as Record<string, unknown>;

  if (typeof h.id !== 'string') {
    console.error('[validateNoteHistory] Invalid id:', h.id);
    return false;
  }
  if (typeof h.note_id !== 'string') {
    console.error('[validateNoteHistory] Invalid note_id:', h.note_id);
    return false;
  }
  if (typeof h.content !== 'string') {
    console.error('[validateNoteHistory] Invalid content:', h.content);
    return false;
  }
  // Description is optional and may not exist in old backups
  if (h.description !== undefined && h.description !== null && typeof h.description !== 'string') {
    // Check if description contains a category value (old format migration)
    if (h.description !== 'todo' && h.description !== 'followup' && h.description !== 'notes') {
      console.error('[validateNoteHistory] Invalid description:', h.description);
      return false;
    }
  }
  // Category validation - accept string or number (old format had numbers)
  const validCategories = ['todo', 'followup', 'notes'];
  if (!validCategories.includes(h.category as string)) {
    // Check if this is an old format where category contains completed (0/1 or '0'/'1')
    if (h.category !== 0 && h.category !== 1 && h.category !== '0' && h.category !== '1') {
      console.error('[validateNoteHistory] Invalid category:', h.category);
      return false;
    }
    // Old format detected - will need migration during import
    console.log('[validateNoteHistory] Detected old format, will migrate during import');
  }
  // Completed validation - accept boolean or number (old format)
  if (typeof h.completed !== 'boolean' && h.completed !== 0 && h.completed !== 1) {
    console.error('[validateNoteHistory] Invalid completed:', h.completed);
    return false;
  }
  if (typeof h.changed_at !== 'string') {
    console.error('[validateNoteHistory] Invalid changed_at:', h.changed_at);
    return false;
  }

  return true;
}

/**
 * Validate a single label object
 */
function validateLabel(label: unknown): label is Label {
  if (!label || typeof label !== 'object') {
    console.error('[validateLabel] Not an object');
    return false;
  }

  const l = label as Record<string, unknown>;

  if (typeof l.id !== 'string') {
    console.error('[validateLabel] Invalid id:', l.id);
    return false;
  }
  if (typeof l.name !== 'string') {
    console.error('[validateLabel] Invalid name:', l.name);
    return false;
  }
  if (typeof l.color !== 'string') {
    console.error('[validateLabel] Invalid color:', l.color);
    return false;
  }
  if (typeof l.created_at !== 'string') {
    console.error('[validateLabel] Invalid created_at:', l.created_at);
    return false;
  }
  if (typeof l.updated_at !== 'string') {
    console.error('[validateLabel] Invalid updated_at:', l.updated_at);
    return false;
  }

  return true;
}

/**
 * Validate a single note-label relationship
 */
function validateNoteLabel(noteLabel: unknown): noteLabel is NoteLabel {
  if (!noteLabel || typeof noteLabel !== 'object') {
    console.error('[validateNoteLabel] Not an object');
    return false;
  }

  const nl = noteLabel as Record<string, unknown>;

  if (typeof nl.note_id !== 'string') {
    console.error('[validateNoteLabel] Invalid note_id:', nl.note_id);
    return false;
  }
  if (typeof nl.label_id !== 'string') {
    console.error('[validateNoteLabel] Invalid label_id:', nl.label_id);
    return false;
  }
  if (typeof nl.created_at !== 'string') {
    console.error('[validateNoteLabel] Invalid created_at:', nl.created_at);
    return false;
  }

  return true;
}
