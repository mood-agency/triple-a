/**
 * Note-related tools for Triple-A Agent
 */

import { z } from 'zod';
import { createClient } from '@triple-a/client';
import type { ToolContext } from '../types';

// Parameter schemas
const createNoteParams = z.object({
  content: z.string().describe('The note title/content (required)'),
  category: z.enum(['todo', 'followup', 'notes', 'meeting'])
    .default('todo')
    .describe('Type of note. Default: todo'),
  date: z.string()
    .describe('Date in YYYY-MM-DD format. Use "today" for current date.'),
  description: z.string().optional()
    .describe('Additional details or description'),
  deadline: z.string().optional()
    .describe('Deadline in YYYY-MM-DD format'),
  project_id: z.string().optional()
    .describe('UUID of project to associate with'),
});

const listNotesParams = z.object({
  date: z.string().optional()
    .describe('Filter by specific date (YYYY-MM-DD). Use "today" for current date.'),
  category: z.enum(['todo', 'followup', 'notes', 'meeting']).optional()
    .describe('Filter by note category'),
  completed: z.boolean().optional()
    .describe('Filter by completion status. false = pending, true = completed'),
  project_id: z.string().optional()
    .describe('Filter by project UUID'),
  limit: z.number().optional().default(20)
    .describe('Maximum number of results (default: 20, max: 100)'),
});

const searchNotesParams = z.object({
  query: z.string().describe('Search term to find in note content/description'),
  category: z.enum(['todo', 'followup', 'notes', 'meeting']).optional()
    .describe('Filter results by category'),
  completed: z.boolean().optional()
    .describe('Filter by completion status'),
  limit: z.number().optional().default(20)
    .describe('Maximum results to return (default: 20)'),
});

const updateNoteParams = z.object({
  note_id: z.string().describe('UUID of the note to update'),
  content: z.string().optional().describe('Updated content/title'),
  description: z.string().optional().describe('Updated description'),
  completed: z.boolean().optional().describe('Mark as completed (true) or incomplete (false)'),
  category: z.enum(['todo', 'followup', 'notes', 'meeting']).optional()
    .describe('Updated category'),
  date: z.string().optional().describe('Updated date (YYYY-MM-DD)'),
  deadline: z.string().optional().describe('Updated deadline (YYYY-MM-DD)'),
});

const deleteNoteParams = z.object({
  note_id: z.string().describe('UUID of the note to delete'),
});

const getNoteParams = z.object({
  note_id: z.string().describe('UUID of the note to retrieve'),
});

// Tool definitions
export const createNoteTool = {
  name: 'create_note' as const,
  description: 'Create a new note or task in Triple-A. Automatically uses today\'s date if not specified.',
  parameters: createNoteParams,
  execute: async (params: z.infer<typeof createNoteParams>, context: ToolContext) => {
    const client = createClient({
      apiKey: context.apiKey,
      baseURL: context.baseURL
    });

    const date = params.date === 'today'
      ? new Date().toISOString().split('T')[0]
      : params.date;

    const note = await client.createNote({
      content: params.content,
      category: params.category,
      date,
      description: params.description,
      deadline: params.deadline,
      project_id: params.project_id,
    });

    return note;
  },
};

export const listNotesTool = {
  name: 'list_notes' as const,
  description: 'List notes with optional filters. Great for viewing today\'s tasks, pending todos, or notes by project/category.',
  parameters: listNotesParams,
  execute: async (params: z.infer<typeof listNotesParams>, context: ToolContext) => {
    const client = createClient({
      apiKey: context.apiKey,
      baseURL: context.baseURL
    });

    const date = params.date === 'today'
      ? new Date().toISOString().split('T')[0]
      : params.date;

    const response = await client.getNotes({
      date,
      category: params.category,
      completed: params.completed,
      project_id: params.project_id,
      limit: Math.min(params.limit || 20, 100),
    });

    return response.data;
  },
};

export const searchNotesTool = {
  name: 'search_notes' as const,
  description: 'Search notes by text content. Searches across note content and descriptions.',
  parameters: searchNotesParams,
  execute: async (params: z.infer<typeof searchNotesParams>, context: ToolContext) => {
    const client = createClient({
      apiKey: context.apiKey,
      baseURL: context.baseURL
    });

    const response = await client.searchNotes({
      query: params.query,
      filters: {
        category: params.category,
        completed: params.completed,
      },
      limit: params.limit,
    });

    return response.data;
  },
};

export const updateNoteTool = {
  name: 'update_note' as const,
  description: 'Update one or more properties of an existing note. Can update content, completion status, category, etc.',
  parameters: updateNoteParams,
  execute: async (params: z.infer<typeof updateNoteParams>, context: ToolContext) => {
    const client = createClient({
      apiKey: context.apiKey,
      baseURL: context.baseURL
    });

    const { note_id, ...updateData } = params;
    const note = await client.updateNote(note_id, updateData);

    return note;
  },
};

export const deleteNoteTool = {
  name: 'delete_note' as const,
  description: 'Delete a note (soft delete - can be recovered). Removes from normal view but preserves in history.',
  parameters: deleteNoteParams,
  execute: async (params: z.infer<typeof deleteNoteParams>, context: ToolContext) => {
    const client = createClient({
      apiKey: context.apiKey,
      baseURL: context.baseURL
    });

    await client.deleteNote(params.note_id);

    return { success: true, message: 'Note deleted successfully' };
  },
};

export const getNoteTool = {
  name: 'get_note' as const,
  description: 'Get full details of a specific note by its ID',
  parameters: getNoteParams,
  execute: async (params: z.infer<typeof getNoteParams>, context: ToolContext) => {
    const client = createClient({
      apiKey: context.apiKey,
      baseURL: context.baseURL
    });

    const note = await client.getNote(params.note_id);

    return note;
  },
};
