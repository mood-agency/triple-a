/**
 * TypeScript types for Triple-A Agent
 */

export interface AgentConfig {
  /** Triple-A API key for authentication */
  apiKey: string;
  /** Base URL for Triple-A API (default: http://localhost:3000) */
  baseURL?: string;
  /** AssemblyAI API key for transcription features (optional) */
  assemblyaiApiKey?: string;
}

export interface ChatOptions {
  /** Conversation history for context */
  history?: ConversationMessage[];
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ToolContext {
  /** User's API key for @triple-a/client */
  apiKey: string;
  /** Base URL for Triple-A API */
  baseURL: string;
  /** AssemblyAI API key for transcription (optional) */
  assemblyaiApiKey?: string;
}
