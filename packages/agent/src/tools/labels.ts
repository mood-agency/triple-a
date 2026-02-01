/**
 * Label-related tools for Triple-A Agent
 */

import { z } from 'zod';
import { createClient } from '@triple-a/client';
import type { ToolContext } from '../types';

// Parameter schemas
const createLabelParams = z.object({
  name: z.string().describe('Label name (e.g., "urgent", "work", "personal")'),
  color: z.string().optional().default('#808080')
    .describe('Hex color code (e.g., "#ff0000" for red). Default: #808080'),
});

const listLabelsParams = z.object({});

// Tool definitions
export const createLabelTool = {
  name: 'create_label' as const,
  description: 'Create a new label/tag for organizing notes',
  parameters: createLabelParams,
  execute: async (params: z.infer<typeof createLabelParams>, context: ToolContext) => {
    const client = createClient({
      apiKey: context.apiKey,
      baseURL: context.baseURL
    });

    const label = await client.createLabel({
      name: params.name,
      color: params.color,
    });

    return label;
  },
};

export const listLabelsTool = {
  name: 'list_labels' as const,
  description: 'List all available labels/tags',
  parameters: listLabelsParams,
  execute: async (_params: z.infer<typeof listLabelsParams>, context: ToolContext) => {
    const client = createClient({
      apiKey: context.apiKey,
      baseURL: context.baseURL
    });

    const response = await client.getLabels();

    return response.data;
  },
};
