/**
 * Project-related tools for Triple-A Agent
 */

import { z } from 'zod';
import { createClient } from '@triple-a/client';
import type { ToolContext } from '../types';

// Parameter schemas
const createProjectParams = z.object({
  name: z.string().describe('Project name'),
  description: z.string().optional().describe('Project description'),
  color: z.string().optional().describe('Project color (hex code)'),
  icon: z.string().optional().describe('Project emoji icon'),
});

const listProjectsParams = z.object({});

// Tool definitions
export const createProjectTool = {
  name: 'create_project' as const,
  description: 'Create a new project for grouping related notes',
  parameters: createProjectParams,
  execute: async (params: z.infer<typeof createProjectParams>, context: ToolContext) => {
    const client = createClient({
      apiKey: context.apiKey,
      baseURL: context.baseURL
    });

    const project = await client.createProject(params);

    return project;
  },
};

export const listProjectsTool = {
  name: 'list_projects' as const,
  description: 'List all available projects',
  parameters: listProjectsParams,
  execute: async (_params: z.infer<typeof listProjectsParams>, context: ToolContext) => {
    const client = createClient({
      apiKey: context.apiKey,
      baseURL: context.baseURL
    });

    const response = await client.getProjects();

    return response.data;
  },
};
