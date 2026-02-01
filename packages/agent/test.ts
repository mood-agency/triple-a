/**
 * Test script for Triple-A Agent
 *
 * Usage:
 *   1. Set ANTHROPIC_API_KEY environment variable
 *   2. Set TRIPLE_A_API_KEY environment variable
 *   3. Ensure Triple-A API is running (http://localhost:3000)
 *   4. Run: pnpm tsx test.ts
 */

import { TripleAAgent } from './src/index';

async function main() {
  // Check environment variables
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY environment variable not set');
    process.exit(1);
  }

  if (!process.env.TRIPLE_A_API_KEY) {
    console.error('❌ TRIPLE_A_API_KEY environment variable not set');
    console.log('\nYou can generate an API key at http://localhost:11000/settings/api-keys');
    process.exit(1);
  }

  console.log('🤖 Triple-A Agent Test\n');

  // Create agent
  const agent = new TripleAAgent({
    apiKey: process.env.TRIPLE_A_API_KEY,
    baseURL: process.env.TRIPLE_A_API_BASE_URL || 'http://localhost:3000',
    assemblyaiApiKey: process.env.ASSEMBLYAI_API_KEY, // Optional
  });

  // Test 1: Create a task
  console.log('Test 1: Create a task');
  console.log('Query: "Create a task to buy milk for tomorrow"');
  try {
    const r1 = await agent.chat('Create a task to buy milk for tomorrow');
    console.log('Response:', r1);
    console.log('✅ Test 1 passed\n');
  } catch (error: any) {
    console.error('❌ Test 1 failed:', error.message);
    console.error(error);
  }

  // Test 2: List tasks
  console.log('Test 2: List tasks');
  console.log('Query: "What tasks do I have?"');
  try {
    const r2 = await agent.chat('What tasks do I have?');
    console.log('Response:', r2);
    console.log('✅ Test 2 passed\n');
  } catch (error: any) {
    console.error('❌ Test 2 failed:', error.message);
    console.error(error);
  }

  // Test 3: Search
  console.log('Test 3: Search');
  console.log('Query: "Search for milk"');
  try {
    const r3 = await agent.chat('Search for milk');
    console.log('Response:', r3);
    console.log('✅ Test 3 passed\n');
  } catch (error: any) {
    console.error('❌ Test 3 failed:', error.message);
    console.error(error);
  }

  // Test 4: Create project
  console.log('Test 4: Create project');
  console.log('Query: "Create a project called Personal"');
  try {
    const r4 = await agent.chat('Create a project called Personal');
    console.log('Response:', r4);
    console.log('✅ Test 4 passed\n');
  } catch (error: any) {
    console.error('❌ Test 4 failed:', error.message);
    console.error(error);
  }

  // Test 5: Multi-step with history
  console.log('Test 5: Multi-step with conversation history');
  console.log('History: User created a task, assistant confirmed');
  console.log('Query: "Mark it as complete"');
  try {
    const history = [
      { role: 'user' as const, content: 'Create a task to call John' },
      { role: 'assistant' as const, content: '✅ Task created! "Call John" for today.' },
    ];
    const r5 = await agent.chat('Mark it as complete', { history });
    console.log('Response:', r5);
    console.log('✅ Test 5 passed\n');
  } catch (error: any) {
    console.error('❌ Test 5 failed:', error.message);
    console.error(error);
  }

  // Test 6: Web search
  console.log('Test 6: Web search');
  console.log('Query: "Search for TypeScript best practices"');
  try {
    const r6 = await agent.chat('Search for TypeScript best practices');
    console.log('Response:', r6);
    console.log('✅ Test 6 passed\n');
  } catch (error: any) {
    console.error('❌ Test 6 failed:', error.message);
    console.error(error);
  }

  // Test 7: Transcription (only if API key is set)
  if (process.env.ASSEMBLYAI_API_KEY) {
    console.log('Test 7: Audio transcription');
    console.log('Note: This test is skipped as it requires a valid audio URL');
    console.log('Example query: "Transcribe this audio: https://example.com/audio.mp3"\n');
  } else {
    console.log('Test 7: Audio transcription - SKIPPED (no ASSEMBLYAI_API_KEY)\n');
  }

  console.log('🎉 All tests completed!');
}

main().catch(console.error);
