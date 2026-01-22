/**
 * Express server for Railway deployment
 * Serves static files and handles API endpoints:
 * - Email webhook for Cloudflare Email Routing
 * - YouTube metadata and captions
 * - Text summarization with AI
 */

import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }))

// CORS headers for API
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

// Apply CORS to all /api routes
app.options('/api/*', (req, res) => {
  res.set(corsHeaders).status(200).send('ok')
})

// ============================================
// YouTube API Endpoints
// ============================================

// YouTube Data API key
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY

/**
 * Get YouTube video metadata
 * POST /api/youtube-metadata
 * Body: { videoId: string }
 */
app.post('/api/youtube-metadata', async (req, res) => {
  res.set(corsHeaders)

  try {
    const { videoId } = req.body

    if (!videoId) {
      return res.status(400).json({ error: 'videoId is required', code: 'INVALID_REQUEST' })
    }

    if (!YOUTUBE_API_KEY) {
      return res.status(500).json({ error: 'YouTube API not configured', code: 'NOT_CONFIGURED' })
    }

    // Fetch video details from YouTube Data API
    const url = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${YOUTUBE_API_KEY}&part=snippet,contentDetails,statistics`
    const response = await fetch(url)
    const data = await response.json()

    if (!response.ok) {
      console.error('YouTube API error:', data)
      return res.status(response.status).json({ error: 'YouTube API error', code: 'API_ERROR', details: data.error?.message })
    }

    if (!data.items || data.items.length === 0) {
      return res.status(404).json({ error: 'Video not found', code: 'VIDEO_NOT_FOUND' })
    }

    const video = data.items[0]
    const metadata = {
      videoId: video.id,
      title: video.snippet.title,
      channelName: video.snippet.channelTitle,
      channelId: video.snippet.channelId,
      thumbnailUrl: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.default?.url,
      duration: video.contentDetails.duration,
      publishedAt: video.snippet.publishedAt,
      viewCount: video.statistics?.viewCount,
      description: video.snippet.description,
    }

    return res.status(200).json(metadata)

  } catch (error) {
    console.error('Error fetching YouTube metadata:', error)
    return res.status(500).json({ error: 'Failed to fetch video metadata', code: 'NETWORK_ERROR', details: error.message })
  }
})

/**
 * Get YouTube captions
 * POST /api/youtube-captions
 * Body: { videoId: string, action: 'list' | 'get', languageCode?: string }
 */
app.post('/api/youtube-captions', async (req, res) => {
  res.set(corsHeaders)

  try {
    const { videoId, action, languageCode } = req.body

    if (!videoId) {
      return res.status(400).json({ error: 'videoId is required', code: 'INVALID_REQUEST' })
    }

    if (action === 'list') {
      // List available caption tracks using YouTube Data API
      if (!YOUTUBE_API_KEY) {
        return res.status(500).json({ error: 'YouTube API not configured', code: 'NOT_CONFIGURED' })
      }

      const url = `https://www.googleapis.com/youtube/v3/captions?videoId=${videoId}&key=${YOUTUBE_API_KEY}&part=snippet`
      const response = await fetch(url)
      const data = await response.json()

      if (!response.ok) {
        // If captions API fails, try to get auto-generated captions info
        console.log('Captions API returned error, checking for auto-captions')
        return res.status(200).json({ tracks: [] })
      }

      const tracks = (data.items || []).map(item => ({
        id: item.id,
        language: item.snippet.language,
        languageName: item.snippet.name || item.snippet.language,
        kind: item.snippet.trackKind === 'ASR' ? 'asr' : 'standard',
        isDefault: item.snippet.isDefault || false,
      }))

      return res.status(200).json({ tracks })

    } else if (action === 'get') {
      // Get transcription text - use youtube-transcript service or scraping
      // For now, we'll use a public transcript API
      const transcriptUrl = `https://www.youtube.com/watch?v=${videoId}`

      try {
        // Try to fetch transcript using youtubetranscript.com API (public)
        const apiUrl = `https://youtubetranscript.com/?server_vid2=${videoId}`
        const response = await fetch(apiUrl)
        const xml = await response.text()

        if (!response.ok || !xml.includes('<transcript>')) {
          return res.status(404).json({ error: 'No captions available', code: 'NO_CAPTIONS' })
        }

        // Parse XML transcript
        const textMatches = xml.match(/<text[^>]*>([^<]*)<\/text>/g) || []
        const segments = textMatches.map(match => {
          const startMatch = match.match(/start="([^"]*)"/)
          const durMatch = match.match(/dur="([^"]*)"/)
          const textMatch = match.match(/>([^<]*)</)
          return {
            start: startMatch ? parseFloat(startMatch[1]) : 0,
            duration: durMatch ? parseFloat(durMatch[1]) : 0,
            text: textMatch ? decodeHtmlEntities(textMatch[1]) : '',
          }
        })

        const fullText = segments.map(s => s.text).join(' ')

        return res.status(200).json({
          text: fullText,
          segments,
          language: languageCode || 'en',
          languageName: languageCode === 'es' ? 'Spanish' : 'English',
          isAutoGenerated: true,
        })

      } catch (transcriptError) {
        console.error('Error fetching transcript:', transcriptError)
        return res.status(404).json({ error: 'Failed to fetch captions', code: 'CAPTION_FETCH_FAILED' })
      }

    } else {
      return res.status(400).json({ error: 'action must be "list" or "get"', code: 'INVALID_REQUEST' })
    }

  } catch (error) {
    console.error('Error in youtube-captions:', error)
    return res.status(500).json({ error: 'Failed to process captions request', code: 'PROCESSING_FAILED', details: error.message })
  }
})

/**
 * Decode HTML entities in transcript text
 */
function decodeHtmlEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
}

// ============================================
// Summarization API Endpoint
// ============================================

/**
 * Summarize text using AI
 * POST /api/summarize
 * Body: { text: string, videoTitle?: string, language?: string }
 */
app.post('/api/summarize', async (req, res) => {
  res.set(corsHeaders)

  try {
    const { text, videoTitle, language = 'es' } = req.body

    if (!text) {
      return res.status(400).json({ error: 'text is required', code: 'INVALID_REQUEST' })
    }

    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY

    // Truncate very long texts
    const maxLength = 100000
    const truncatedText = text.length > maxLength ? text.substring(0, maxLength) + '...' : text

    const systemPrompt = language === 'es'
      ? `Eres un asistente que resume contenido de videos. Responde siempre en español.`
      : `You are an assistant that summarizes video content. Always respond in English.`

    const userPrompt = language === 'es'
      ? `Resume el siguiente texto${videoTitle ? ` del video "${videoTitle}"` : ''}. Proporciona:
1. Un resumen conciso (2-3 párrafos)
2. Una lista de 3-5 puntos clave
3. Los temas principales (como tags)

Texto:
${truncatedText}

Responde en formato JSON:
{
  "summary": "...",
  "keyPoints": ["...", "..."],
  "topics": ["...", "..."]
}`
      : `Summarize the following text${videoTitle ? ` from the video "${videoTitle}"` : ''}. Provide:
1. A concise summary (2-3 paragraphs)
2. A list of 3-5 key points
3. Main topics (as tags)

Text:
${truncatedText}

Respond in JSON format:
{
  "summary": "...",
  "keyPoints": ["...", "..."],
  "topics": ["...", "..."]
}`

    let result

    if (ANTHROPIC_API_KEY) {
      // Use Anthropic Claude API
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('Anthropic API error:', data)
        return res.status(500).json({ error: 'AI summarization failed', code: 'SUMMARY_FAILED', details: data.error?.message })
      }

      const content = data.content[0]?.text || ''
      result = parseJsonResponse(content)

    } else if (OPENAI_API_KEY) {
      // Use OpenAI API as fallback
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 2000,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('OpenAI API error:', data)
        return res.status(500).json({ error: 'AI summarization failed', code: 'SUMMARY_FAILED', details: data.error?.message })
      }

      const content = data.choices[0]?.message?.content || ''
      result = parseJsonResponse(content)

    } else {
      return res.status(500).json({ error: 'No AI API configured', code: 'NOT_CONFIGURED' })
    }

    return res.status(200).json(result)

  } catch (error) {
    console.error('Error in summarize:', error)
    return res.status(500).json({ error: 'Failed to summarize text', code: 'PROCESSING_FAILED', details: error.message })
  }
})

/**
 * Parse JSON from AI response (handles markdown code blocks)
 */
function parseJsonResponse(content) {
  try {
    // Try to extract JSON from markdown code block
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim()
    return JSON.parse(jsonStr)
  } catch {
    // If parsing fails, return a basic structure
    return {
      summary: content,
      keyPoints: [],
      topics: [],
    }
  }
}

// ============================================
// Email Webhook Endpoint
// ============================================

// Email webhook endpoint
app.post('/api/email-webhook', async (req, res) => {
  res.set(corsHeaders)

  try {
    // Verify webhook secret
    const webhookSecret = process.env.EMAIL_WEBHOOK_SECRET
    const providedSecret = req.headers['x-webhook-secret']

    if (webhookSecret && providedSecret !== webhookSecret) {
      console.error('Invalid webhook secret')
      return res.status(401).json({ error: 'Unauthorized', code: 'INVALID_SECRET' })
    }

    const email = req.body

    console.log('Received email:', {
      from: email.from,
      to: email.to,
      subject: email.subject,
      hasText: !!email.text,
      hasHtml: !!email.html,
    })

    // Validate required fields
    if (!email.from) {
      return res.status(400).json({ error: 'Email must have a sender (from)', code: 'INVALID_EMAIL' })
    }

    if (!email.subject && !email.text) {
      return res.status(400).json({ error: 'Email must have subject or body', code: 'INVALID_EMAIL' })
    }

    // Check Supabase config
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase not configured')
      return res.status(500).json({ error: 'Server not configured', code: 'NOT_CONFIGURED' })
    }

    // Create Supabase client
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

    // Extract email address
    const fromEmail = extractEmail(email.from)
    if (!fromEmail) {
      return res.status(400).json({ error: 'Invalid sender email format', code: 'INVALID_EMAIL' })
    }

    // Look up user by email
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('email', fromEmail)
      .single()

    if (profileError || !profile) {
      console.error('User not found for email:', fromEmail)
      return res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND', email: fromEmail })
    }

    const userId = profile.id
    console.log('Found user:', userId, 'for email:', fromEmail)

    // Prepare the note
    const noteContent = email.subject || 'Email task'
    const noteDescription = formatEmailDescription(email)
    const noteDate = new Date().toISOString().split('T')[0]
    const now = new Date().toISOString()

    // Get minimum sort_order
    const { data: existingNotes } = await supabaseClient
      .from('notes')
      .select('sort_order')
      .eq('user_id', userId)
      .eq('date', noteDate)
      .order('sort_order', { ascending: true })
      .limit(1)

    const minSortOrder = existingNotes && existingNotes.length > 0
      ? existingNotes[0].sort_order - 1
      : 0

    // Insert the note
    const { data: note, error: insertError } = await supabaseClient
      .from('notes')
      .insert({
        user_id: userId,
        date: noteDate,
        content: noteContent,
        description: noteDescription,
        category: 'todo',
        completed: false,
        pinned: false,
        sort_order: minSortOrder,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Failed to create note:', insertError)
      return res.status(500).json({ error: 'Failed to create task', code: 'INSERT_FAILED', details: insertError.message })
    }

    console.log('Created note from email:', note.id)

    return res.status(200).json({
      success: true,
      noteId: note.id,
      message: `Task created: ${noteContent}`
    })

  } catch (error) {
    console.error('Error in email-webhook:', error)
    return res.status(500).json({
      error: 'Failed to process email',
      code: 'PROCESSING_FAILED',
      details: error.message
    })
  }
})

// Serve static files from dist
app.use(express.static(path.join(__dirname, 'dist')))

// SPA fallback - serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

// Helper functions
function formatEmailDescription(email) {
  const parts = []

  if (email.from) {
    parts.push(`From: ${email.from}`)
  }

  if (email.date) {
    parts.push(`Date: ${email.date}`)
  }

  if (parts.length > 0) {
    parts.push('---')
  }

  if (email.text) {
    const text = email.text.trim()
    const maxLength = 2000
    if (text.length > maxLength) {
      parts.push(text.substring(0, maxLength) + '...')
    } else {
      parts.push(text)
    }
  } else if (email.html) {
    const text = stripHtml(email.html).trim()
    const maxLength = 2000
    if (text.length > maxLength) {
      parts.push(text.substring(0, maxLength) + '...')
    } else {
      parts.push(text)
    }
  }

  return parts.join('\n') || null
}

function stripHtml(html) {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractEmail(from) {
  if (!from) return null

  const bracketMatch = from.match(/<([^>]+@[^>]+)>/)
  if (bracketMatch) {
    return bracketMatch[1].toLowerCase().trim()
  }

  const emailMatch = from.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
  if (emailMatch) {
    return from.toLowerCase().trim()
  }

  const anyEmailMatch = from.match(/([^\s<>]+@[^\s<>]+\.[^\s<>]+)/)
  if (anyEmailMatch) {
    return anyEmailMatch[1].toLowerCase().trim()
  }

  return null
}
