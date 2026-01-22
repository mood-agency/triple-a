import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SummarizationResult {
  summary: string
  keyPoints: string[]
  topics?: string[]
}

const MAX_TEXT_LENGTH = 100000 // ~25k tokens

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { text, videoTitle, language = 'es' } = await req.json()

    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'text is required', code: 'INVALID_REQUEST' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate text length
    if (text.length > MAX_TEXT_LENGTH) {
      return new Response(
        JSON.stringify({
          error: 'Text too long. Maximum length is 100,000 characters.',
          code: 'TEXT_TOO_LONG'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Gemini API key from secrets
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: 'Summarization service not configured', code: 'NOT_CONFIGURED' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate summary using Gemini
    const result = await generateSummary(text, videoTitle, language, geminiApiKey)

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in summarize function:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to generate summary',
        code: 'SUMMARY_FAILED',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Generate summary using Google Gemini API
 */
async function generateSummary(
  text: string,
  videoTitle: string | undefined,
  language: string,
  apiKey: string
): Promise<SummarizationResult> {
  const isSpanish = language === 'es'

  const systemPrompt = isSpanish
    ? `Eres un asistente experto en resumir transcripciones de videos. Tu tarea es analizar la transcripción y proporcionar:
1. Un resumen conciso y claro del contenido principal (2-3 párrafos)
2. Los puntos clave más importantes (5-7 bullets)
3. Los temas principales que se tratan (3-5 temas como etiquetas)

Responde SIEMPRE en español. Sé directo y evita frases como "En este video..." o "El autor explica...". Ve directo al contenido.`
    : `You are an expert assistant at summarizing video transcriptions. Your task is to analyze the transcript and provide:
1. A concise and clear summary of the main content (2-3 paragraphs)
2. The most important key points (5-7 bullets)
3. The main topics covered (3-5 topics as tags)

Always respond in English. Be direct and avoid phrases like "In this video..." or "The author explains...". Go straight to the content.`

  const userPrompt = videoTitle
    ? `${isSpanish ? 'Título del video' : 'Video title'}: "${videoTitle}"\n\n${isSpanish ? 'Transcripción' : 'Transcript'}:\n${text}`
    : `${isSpanish ? 'Transcripción' : 'Transcript'}:\n${text}`

  const responseFormat = isSpanish
    ? `Responde en formato JSON con esta estructura exacta:
{
  "summary": "El resumen aquí...",
  "keyPoints": ["Punto 1", "Punto 2", ...],
  "topics": ["Tema 1", "Tema 2", ...]
}`
    : `Respond in JSON format with this exact structure:
{
  "summary": "The summary here...",
  "keyPoints": ["Point 1", "Point 2", ...],
  "topics": ["Topic 1", "Topic 2", ...]
}`

  // Call Gemini API
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `${systemPrompt}\n\n${userPrompt}\n\n${responseFormat}`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.3,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_NONE'
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_NONE'
          },
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_NONE'
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_NONE'
          }
        ]
      })
    }
  )

  if (!response.ok) {
    const errorData = await response.json()
    console.error('Gemini API error:', errorData)
    throw new Error(`Gemini API error: ${errorData.error?.message || 'Unknown error'}`)
  }

  const data = await response.json()

  // Extract the generated text
  const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!generatedText) {
    throw new Error('No response generated from Gemini')
  }

  // Parse the JSON response
  try {
    const result = JSON.parse(generatedText)
    return {
      summary: result.summary || '',
      keyPoints: Array.isArray(result.keyPoints) ? result.keyPoints : [],
      topics: Array.isArray(result.topics) ? result.topics : [],
    }
  } catch {
    // If JSON parsing fails, try to extract content manually
    console.warn('Failed to parse Gemini response as JSON, extracting manually')
    return {
      summary: generatedText,
      keyPoints: [],
      topics: [],
    }
  }
}
