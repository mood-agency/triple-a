/**
 * Example: Using Web Search and Transcription features
 *
 * Usage:
 *   1. Set ANTHROPIC_API_KEY environment variable
 *   2. Set TRIPLE_A_API_KEY environment variable
 *   3. Set ASSEMBLYAI_API_KEY environment variable (for transcription)
 *   4. Run: pnpm tsx example-search-transcribe.ts
 */

import { TripleAAgent } from './src/index';

async function main() {
  console.log('🔍 Triple-A Agent - Web Search & Transcription Examples\n');

  // Create agent with all API keys
  const agent = new TripleAAgent({
    apiKey: process.env.TRIPLE_A_API_KEY!,
    baseURL: process.env.TRIPLE_A_API_BASE_URL || 'http://localhost:3000',
    assemblyaiApiKey: process.env.ASSEMBLYAI_API_KEY, // Optional
  });

  // Example 1: Web Search
  console.log('📡 Example 1: Web Search');
  console.log('Query: "What are the latest trends in AI?"');
  try {
    const response = await agent.chat('Search for the latest trends in AI');
    console.log('Response:', response);
    console.log('✅ Success\n');
  } catch (error: any) {
    console.error('❌ Error:', error.message, '\n');
  }

  // Example 2: Targeted Search
  console.log('📡 Example 2: Targeted Search');
  console.log('Query: "Find React 19 documentation"');
  try {
    const response = await agent.chat('Search for React 19 new features');
    console.log('Response:', response);
    console.log('✅ Success\n');
  } catch (error: any) {
    console.error('❌ Error:', error.message, '\n');
  }

  // Example 3: Search + Task Creation
  console.log('📡 Example 3: Combined Search and Task Creation');
  console.log('Query: "Search for TypeScript 5.7 features and create a task to review them"');
  try {
    const response = await agent.chat(
      'Search for TypeScript 5.7 new features and create a task to review them tomorrow'
    );
    console.log('Response:', response);
    console.log('✅ Success\n');
  } catch (error: any) {
    console.error('❌ Error:', error.message, '\n');
  }

  // Example 4: Audio Transcription (requires AssemblyAI API key)
  if (process.env.ASSEMBLYAI_API_KEY) {
    console.log('🎙️ Example 4: Audio Transcription');
    console.log('Note: This requires a valid audio URL');
    console.log('Example usage:\n');
    console.log('  const response = await agent.chat(');
    console.log('    "Transcribe this audio: https://example.com/meeting.mp3"');
    console.log('  );\n');

    // Example with speaker diarization
    console.log('🎙️ Example 5: Transcription with Speaker Labels');
    console.log('Example usage:\n');
    console.log('  const response = await agent.chat(');
    console.log('    "Transcribe with speaker identification: https://example.com/meeting.mp4"');
    console.log('  );\n');

    console.log('💡 Transcription features available:');
    console.log('   - Speaker diarization (identify different speakers)');
    console.log('   - Auto highlights (key phrases detection)');
    console.log('   - Sentiment analysis (positive/negative/neutral)');
    console.log('   - Entity detection (people, places, organizations)');
    console.log('   - Multi-language support with auto-detection\n');
  } else {
    console.log('🎙️ Transcription Examples - SKIPPED');
    console.log('Set ASSEMBLYAI_API_KEY to enable transcription features\n');
  }

  console.log('🎉 Examples completed!');
}

main().catch(console.error);
