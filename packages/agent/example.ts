/**
 * Simple CLI example for Triple-A Agent
 *
 * Usage:
 *   export ANTHROPIC_API_KEY=your_key
 *   export TRIPLE_A_API_KEY=your_triple_a_key
 *   pnpm tsx example.ts
 */

import { TripleAAgent } from './src/index';
import * as readline from 'readline';

async function main() {
  // Check environment
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY not set');
    process.exit(1);
  }

  if (!process.env.TRIPLE_A_API_KEY) {
    console.error('❌ TRIPLE_A_API_KEY not set');
    console.log('Generate one at: http://localhost:11000/settings/api-keys');
    process.exit(1);
  }

  console.log('🤖 Triple-A Agent CLI\n');
  console.log('Type your queries in natural language. Type "exit" to quit.\n');

  // Create agent
  const agent = new TripleAAgent({
    apiKey: process.env.TRIPLE_A_API_KEY,
    baseURL: process.env.TRIPLE_A_API_BASE_URL || 'http://localhost:3000',
  });

  // Conversation history
  const history: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> ',
  });

  rl.prompt();

  rl.on('line', async (input: string) => {
    const query = input.trim();

    if (!query) {
      rl.prompt();
      return;
    }

    if (query.toLowerCase() === 'exit' || query.toLowerCase() === 'quit') {
      console.log('\n👋 Goodbye!');
      rl.close();
      process.exit(0);
    }

    if (query.toLowerCase() === 'clear') {
      history.length = 0;
      console.log('✨ Conversation history cleared\n');
      rl.prompt();
      return;
    }

    try {
      // Send query to agent
      const response = await agent.chat(query, { history });

      // Update history
      history.push({ role: 'user', content: query });
      history.push({ role: 'assistant', content: response });

      // Keep history manageable (last 10 messages)
      if (history.length > 20) {
        history.splice(0, history.length - 20);
      }

      console.log(`\n${response}\n`);
    } catch (error: any) {
      console.error(`\n❌ Error: ${error.message}\n`);
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log('\n👋 Goodbye!');
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
