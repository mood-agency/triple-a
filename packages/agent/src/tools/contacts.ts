/**
 * Contact-related tools for Triple-A Agent
 */

import { z } from 'zod';
import { createClient } from '@triple-a/client';
import type { ToolContext } from '../types';

// Parameter schemas
const createContactParams = z.object({
  name: z.string().describe('Contact name'),
  email: z.string().optional().describe('Contact email address'),
  phone: z.string().optional().describe('Contact phone number'),
});

const listContactsParams = z.object({});

// Tool definitions
export const createContactTool = {
  name: 'create_contact' as const,
  description: 'Create a new contact that can be assigned to notes/tasks',
  parameters: createContactParams,
  execute: async (params: z.infer<typeof createContactParams>, context: ToolContext) => {
    const client = createClient({
      apiKey: context.apiKey,
      baseURL: context.baseURL
    });

    const contact = await client.createContact(params);

    return contact;
  },
};

export const listContactsTool = {
  name: 'list_contacts' as const,
  description: 'List all available contacts',
  parameters: listContactsParams,
  execute: async (_params: z.infer<typeof listContactsParams>, context: ToolContext) => {
    const client = createClient({
      apiKey: context.apiKey,
      baseURL: context.baseURL
    });

    const response = await client.getContacts();

    return response.data;
  },
};
