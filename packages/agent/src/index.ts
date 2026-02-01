/**
 * @triple-a/agent
 *
 * AI agent for Triple-A task management using Agno and Claude.
 * Process natural language queries and execute tasks via Triple-A API.
 *
 * @example
 * ```typescript
 * import { TripleAAgent } from '@triple-a/agent';
 *
 * const agent = new TripleAAgent({
 *   apiKey: 'sk_live_...',
 *   baseURL: 'http://localhost:3000'
 * });
 *
 * const response = await agent.chat('Create a task to buy milk');
 * console.log(response);
 * // => "✅ Task created! Buy milk for 2026-01-31"
 * ```
 */

import { Agent } from 'agno';
import { allTools } from './tools';
import type { AgentConfig, ChatOptions, ToolContext } from './types';

export class TripleAAgent {
  private agent: Agent;
  private context: ToolContext;

  constructor(config: AgentConfig) {
    this.context = {
      apiKey: config.apiKey,
      baseURL: config.baseURL || 'http://localhost:3000',
      assemblyaiApiKey: config.assemblyaiApiKey,
    };

    // Create Agno agent with Claude and all tools
    this.agent = new Agent({
      model: 'anthropic/claude-3-5-sonnet-20241022',
      tools: allTools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        execute: async (params: any) => {
          return await tool.execute(params, this.context);
        },
      })),
      systemInstructions: `You are a helpful assistant for Triple-A task management.

**Current date**: ${new Date().toISOString().split('T')[0]}

**Your role**: Help users manage their tasks, notes, follow-ups, and meetings through natural conversation.

**Capabilities**:
- Create and manage notes with different categories (todo, followup, notes, meeting)
- Search and filter notes by date, completion, category, project
- Organize notes with labels and projects
- Assign tasks to contacts
- Execute batch operations for efficiency
- Search the web using DuckDuckGo for real-time information
- Transcribe audio/video files using AssemblyAI (if API key configured)

**Smart defaults**:
- When no date is specified, use today's date
- When no category is specified for tasks, use 'todo'
- Be proactive: if user says "add a task", create it immediately
- Confirm actions with brief, friendly messages

**Response style**:
- Be concise and conversational
- Use emojis appropriately (✅ for completed, 📝 for notes, etc.)
- Confirm what you did (e.g., "Task created!" not just "OK")
- Include relevant IDs for reference when useful
- If something is ambiguous, ask for clarification

Remember: You're here to make task management easy and natural!`,
    });
  }

  /**
   * Process a natural language query and execute the appropriate tools
   *
   * @param message - The user's natural language query
   * @param options - Optional conversation options
   * @returns Promise<string> - The agent's response
   *
   * @example
   * ```typescript
   * // Simple query
   * const response = await agent.chat('What tasks do I have today?');
   *
   * // With conversation history
   * const response = await agent.chat('Mark it as done', {
   *   history: [
   *     { role: 'user', content: 'Create a task to call John' },
   *     { role: 'assistant', content: 'Task created with ID abc123' }
   *   ]
   * });
   * ```
   */
  async chat(message: string, options?: ChatOptions): Promise<string> {
    const messages = [
      ...(options?.history || []).map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: 'user' as const,
        content: message,
      },
    ];

    const response = await this.agent.run({
      messages,
    });

    return response.content;
  }
}

// Re-export types
export type { AgentConfig, ChatOptions, ConversationMessage } from './types';
