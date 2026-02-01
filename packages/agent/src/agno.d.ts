/**
 * Type declarations for agno package
 */

declare module 'agno' {
  export interface AgentConfig {
    model: string;
    tools: Tool[];
    systemInstructions?: string | ((context: any) => string);
  }

  export interface Tool {
    name: string;
    description: string;
    parameters: any;
    execute: (params: any, context?: any) => Promise<any>;
  }

  export interface Message {
    role: 'user' | 'assistant';
    content: string;
  }

  export interface RunOptions {
    messages: Message[];
    context?: any;
  }

  export interface RunResponse {
    content: string;
  }

  export class Agent {
    constructor(config: AgentConfig);
    run(options: RunOptions): Promise<RunResponse>;
  }
}
