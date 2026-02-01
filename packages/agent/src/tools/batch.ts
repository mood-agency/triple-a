/**
 * Batch operations tool for Triple-A Agent
 */

import { z } from 'zod';
import { createClient } from '@triple-a/client';
import type { ToolContext } from '../types';
import type { BatchOperation } from '@triple-a/types';

// Parameter schema - we use a flexible schema and let the API validate the exact structure
const batchOperationsParams = z.object({
  operations: z.array(
    z.union([
      z.object({
        action: z.literal('create'),
        data: z.record(z.any()),
      }),
      z.object({
        action: z.literal('update'),
        id: z.string(),
        data: z.record(z.any()),
      }),
      z.object({
        action: z.literal('delete'),
        id: z.string(),
      }),
    ])
  ).describe('Array of operations to execute'),
});

// Tool definition
export const batchOperationsTool = {
  name: 'batch_operations' as const,
  description: 'Execute multiple create/update/delete operations in a single batch. Useful for bulk operations like "mark all as complete" or "create multiple tasks".',
  parameters: batchOperationsParams,
  execute: async (params: z.infer<typeof batchOperationsParams>, context: ToolContext) => {
    const client = createClient({
      apiKey: context.apiKey,
      baseURL: context.baseURL
    });

    const response = await client.batch({
      operations: params.operations as BatchOperation[],
    });

    return response;
  },
};
