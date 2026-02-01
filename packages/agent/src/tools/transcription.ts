/**
 * AssemblyAI transcription tool for Triple-A Agent
 */

import { z } from 'zod';
import { AssemblyAI } from 'assemblyai';
import type { ToolContext } from '../types';

// Parameter schemas
const transcribeAudioParams = z.object({
  audio_url: z.string().url().describe('URL of the audio/video file to transcribe. Must be publicly accessible or a local file path.'),
  language_code: z.string()
    .optional()
    .describe('Language code (e.g., "en", "es", "fr"). If not specified, language will be auto-detected.'),
  speaker_labels: z.boolean()
    .default(false)
    .describe('Enable speaker diarization to identify different speakers (default: false)'),
  auto_highlights: z.boolean()
    .default(false)
    .describe('Automatically detect key phrases and highlights in the transcription (default: false)'),
  sentiment_analysis: z.boolean()
    .default(false)
    .describe('Analyze sentiment of each sentence (positive/negative/neutral) (default: false)'),
  entity_detection: z.boolean()
    .default(false)
    .describe('Detect and extract named entities (people, places, organizations, etc.) (default: false)'),
});

const getTranscriptParams = z.object({
  transcript_id: z.string().describe('ID of the transcript to retrieve'),
});

// Tool definitions
export const transcribeAudioTool: {
  name: 'transcribe_audio';
  description: string;
  parameters: typeof transcribeAudioParams;
  execute: (params: z.infer<typeof transcribeAudioParams>, context: ToolContext) => Promise<any>;
} = {
  name: 'transcribe_audio' as const,
  description: 'Transcribe audio or video files using AssemblyAI. Supports various audio formats and optional features like speaker identification, sentiment analysis, and entity detection. The transcription is processed asynchronously.',
  parameters: transcribeAudioParams,
  execute: async (params: z.infer<typeof transcribeAudioParams>, context: ToolContext) => {
    if (!context.assemblyaiApiKey) {
      return {
        success: false,
        error: 'AssemblyAI API key not configured. Please set ASSEMBLYAI_API_KEY in your environment or agent config.',
      };
    }

    try {
      const client = new AssemblyAI({
        apiKey: context.assemblyaiApiKey,
      });

      // Start transcription
      const transcript = await client.transcripts.transcribe({
        audio: params.audio_url,
        language_code: params.language_code,
        speaker_labels: params.speaker_labels,
        auto_highlights: params.auto_highlights,
        sentiment_analysis: params.sentiment_analysis,
        entity_detection: params.entity_detection,
      });

      if (transcript.status === 'error') {
        return {
          success: false,
          error: transcript.error,
          transcript_id: transcript.id,
        };
      }

      // Build response with optional features
      const response: any = {
        success: true,
        transcript_id: transcript.id,
        status: transcript.status,
        text: transcript.text,
        confidence: transcript.confidence,
        audio_duration: transcript.audio_duration,
        language_code: transcript.language_code,
      };

      // Add speaker labels if requested
      if (params.speaker_labels && transcript.utterances) {
        response.speakers = transcript.utterances.map((u) => ({
          speaker: u.speaker,
          text: u.text,
          start: u.start,
          end: u.end,
          confidence: u.confidence,
        }));
      }

      // Add highlights if requested
      if (params.auto_highlights && transcript.auto_highlights_result) {
        response.highlights = transcript.auto_highlights_result.results?.map((h) => ({
          text: h.text,
          count: h.count,
          rank: h.rank,
        }));
      }

      // Add sentiment analysis if requested
      if (params.sentiment_analysis && transcript.sentiment_analysis_results) {
        response.sentiment = transcript.sentiment_analysis_results.map((s) => ({
          text: s.text,
          sentiment: s.sentiment,
          confidence: s.confidence,
          start: s.start,
          end: s.end,
        }));
      }

      // Add entities if requested
      if (params.entity_detection && transcript.entities) {
        response.entities = transcript.entities.map((e) => ({
          text: e.text,
          entity_type: e.entity_type,
          start: e.start,
          end: e.end,
        }));
      }

      return response;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Transcription failed',
      };
    }
  },
};

export const getTranscriptTool: {
  name: 'get_transcript';
  description: string;
  parameters: typeof getTranscriptParams;
  execute: (params: z.infer<typeof getTranscriptParams>, context: ToolContext) => Promise<any>;
} = {
  name: 'get_transcript' as const,
  description: 'Retrieve a previously created transcript by its ID. Use this to check the status or get results of an asynchronous transcription.',
  parameters: getTranscriptParams,
  execute: async (params: z.infer<typeof getTranscriptParams>, context: ToolContext) => {
    if (!context.assemblyaiApiKey) {
      return {
        success: false,
        error: 'AssemblyAI API key not configured. Please set ASSEMBLYAI_API_KEY in your environment or agent config.',
      };
    }

    try {
      const client = new AssemblyAI({
        apiKey: context.assemblyaiApiKey,
      });

      const transcript = await client.transcripts.get(params.transcript_id);

      return {
        success: true,
        transcript_id: transcript.id,
        status: transcript.status,
        text: transcript.text,
        confidence: transcript.confidence,
        audio_duration: transcript.audio_duration,
        language_code: transcript.language_code,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to retrieve transcript',
      };
    }
  },
};
