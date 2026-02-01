/**
 * Export all tools for Triple-A Agent
 */

// Note tools
export {
  createNoteTool,
  listNotesTool,
  searchNotesTool,
  updateNoteTool,
  deleteNoteTool,
  getNoteTool,
} from './notes';

// Label tools
export {
  createLabelTool,
  listLabelsTool,
} from './labels';

// Project tools
export {
  createProjectTool,
  listProjectsTool,
} from './projects';

// Contact tools
export {
  createContactTool,
  listContactsTool,
} from './contacts';

// Batch operations
export {
  batchOperationsTool,
} from './batch';

// Search tools
export {
  searchWebTool,
} from './search';

// Transcription tools
export {
  transcribeAudioTool,
  getTranscriptTool,
} from './transcription';

// Export all tools as an array for easy registration
import {
  createNoteTool,
  listNotesTool,
  searchNotesTool,
  updateNoteTool,
  deleteNoteTool,
  getNoteTool,
} from './notes';

import {
  createLabelTool,
  listLabelsTool,
} from './labels';

import {
  createProjectTool,
  listProjectsTool,
} from './projects';

import {
  createContactTool,
  listContactsTool,
} from './contacts';

import {
  batchOperationsTool,
} from './batch';

import {
  searchWebTool,
} from './search';

import {
  transcribeAudioTool,
  getTranscriptTool,
} from './transcription';

// Type for a generic tool
type Tool = {
  name: string;
  description: string;
  parameters: any;
  execute: (params: any, context: any) => Promise<any>;
};

export const allTools: Tool[] = [
  createNoteTool,
  listNotesTool,
  searchNotesTool,
  updateNoteTool,
  deleteNoteTool,
  getNoteTool,
  createLabelTool,
  listLabelsTool,
  createProjectTool,
  listProjectsTool,
  createContactTool,
  listContactsTool,
  batchOperationsTool,
  searchWebTool,
  transcribeAudioTool,
  getTranscriptTool,
];
